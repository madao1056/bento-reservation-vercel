/**
 * Vercel連携用 Google Apps Script コード
 * 弁当予約システム Vercel Bridge
 */

// 設定: 管理者のメールアドレス（ここを変更してください）
const ADMIN_EMAIL = 'yoshihiroinokuchi876@gmail.com'; // お弁当屋さんのメールアドレスを設定
const SHOP_NAME = '惣菜屋レザン'; // お店の名前を設定

// スプレッドシートID（新しく作成したスプレッドシートのIDを設定）
const SPREADSHEET_ID = '1ZnxeHsGGMx9awxzK3eTqrrjtbWjphaEiA4Cs-eVq68Q'; // 実際のスプレッドシートIDに置き換えてください

/**
 * リクエストルーティング - GET/POSTリクエストを適切にルーティング
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getHolidayInfo') {
      return createSuccessResponse(getHolidayInfo());
    }
    
    return createErrorResponse('不正なアクションです', 400);
    
  } catch (error) {
    console.error('=== GETリクエストエラー ===', error);
    return createErrorResponse('システムエラーが発生しました: ' + error.message, 500);
  }
}

/**
 * Vercelからのフォーム送信を受け取るAPI
 * doPost関数でPOSTリクエストを処理
 */
function doPost(e) {
  try {
    console.log('=== Vercel Bridge: リクエスト受信 ===');
    console.log('Content Type:', e.postData?.type);
    console.log('Raw Data:', e.postData?.contents);
    
    // JSONデータを解析
    let requestData;
    try {
      requestData = JSON.parse(e.postData.contents || '{}');
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError);
      return createErrorResponse('不正なJSONデータです', 400);
    }
    
    console.log('解析済みデータ:', requestData);
    
    // バリデーション
    const validation = validateFormData(requestData);
    if (!validation.valid) {
      return createErrorResponse(validation.error, 400);
    }
    
    // スプレッドシートに保存
    const saveResult = saveToSpreadsheet(requestData);
    if (!saveResult.success) {
      return createErrorResponse(saveResult.error, 500);
    }
    
    // メール送信
    const emailResult = sendNotificationEmails(requestData, saveResult.rowNumber);
    
    // 成功レスポンス
    const response = {
      success: true,
      message: 'ご予約を承りました',
      reservationId: generateReservationId(saveResult.rowNumber),
      timestamp: new Date().toISOString(),
      emailSent: emailResult.success
    };
    
    console.log('=== 処理完了 ===', response);
    
    return createSuccessResponse(response);
    
  } catch (error) {
    console.error('=== システムエラー ===', error);
    return createErrorResponse('システムエラーが発生しました: ' + error.message, 500);
  }
}

/**
 * フォームデータのバリデーション
 */
function validateFormData(data) {
  // 必須項目チェック
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { valid: false, error: 'お名前は必須項目です' };
  }
  
  if (!data.email || typeof data.email !== 'string' || data.email.trim().length === 0) {
    return { valid: false, error: 'メールアドレスは必須項目です' };
  }
  
  if (!data.phone || typeof data.phone !== 'string' || data.phone.trim().length === 0) {
    return { valid: false, error: 'お電話番号は必須項目です' };
  }
  
  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return { valid: false, error: '正しいメールアドレスを入力してください' };
  }
  
  // メニューアイテムチェック
  if (!data.menuItems || typeof data.menuItems !== 'object' || Object.keys(data.menuItems).length === 0) {
    return { valid: false, error: 'メニューを1つ以上選択してください' };
  }
  
  return { valid: true };
}

/**
 * スプレッドシートにデータを保存
 */
function saveToSpreadsheet(data) {
  try {
    // スプレッドシートを開く
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName('予約データ');
    
    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = spreadsheet.insertSheet('予約データ');
      // ヘッダーを設定
      sheet.getRange(1, 1, 1, 10).setValues([[
        '受信日時', '名前', 'メールアドレス', '電話番号', 'メニュー', 
        '合計金額', '受け取り日時', 'その他・ご要望', 'ソース', 'ステータス'
      ]]);
      sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    }
    
    // メニューアイテムを文字列に変換
    const menuString = formatMenuItems(data.menuItems);
    const totalAmount = calculateTotalAmount(data.menuItems);
    
    // 受け取り日時の処理
    let pickupDateTime = 'なし';
    if (data.pickupDateTime && data.pickupDateTime !== 'null') {
      pickupDateTime = formatPickupDateTime(data.pickupDateTime);
    }
    
    // データ行を追加
    const rowData = [
      new Date(), // 受信日時
      data.name,
      data.email, 
      data.phone,
      menuString,
      totalAmount,
      pickupDateTime,
      data.message || 'なし',
      'Vercel',
      '未対応'
    ];
    
    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    
    console.log('スプレッドシート保存完了:', newRow);
    
    return { success: true, rowNumber: newRow };
    
  } catch (error) {
    console.error('スプレッドシート保存エラー:', error);
    return { success: false, error: 'データの保存に失敗しました: ' + error.message };
  }
}

/**
 * メニューアイテムを文字列にフォーマット
 */
function formatMenuItems(menuItems) {
  const menuNames = {
    'daily': '日替わり弁当',
    'karaage': '唐揚げ弁当', 
    'fish': '焼き魚弁当',
    'hamburg': 'ハンバーグ弁当',
    'makunouchi': '幕の内弁当',
    'special': '特製弁当',
    'meeting': '会議用弁当',
    'other': 'その他カスタム注文'
  };
  
  const items = [];
  for (const [itemId, quantity] of Object.entries(menuItems)) {
    if (quantity > 0) {
      const name = menuNames[itemId] || itemId;
      items.push(`${name} x ${quantity}`);
    }
  }
  
  return items.join(', ');
}

/**
 * 合計金額を計算
 */
function calculateTotalAmount(menuItems) {
  const prices = {
    'daily': 500,
    'karaage': 550,
    'fish': 600,
    'hamburg': 650,
    'makunouchi': 800,
    'special': 1000,
    'meeting': 0,
    'other': 0
  };
  
  let total = 0;
  for (const [itemId, quantity] of Object.entries(menuItems)) {
    const price = prices[itemId] || 0;
    total += price * quantity;
  }
  
  return total;
}

/**
 * 受け取り日時をフォーマット
 */
function formatPickupDateTime(dateTimeStr) {
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) {
      return 'なし';
    }
    
    return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy年MM月dd日(E) HH:mm');
  } catch (error) {
    console.error('日時フォーマットエラー:', error);
    return 'なし';
  }
}

/**
 * 通知メールを送信
 */
function sendNotificationEmails(data, rowNumber) {
  try {
    // お客様への自動返信メール
    sendCustomerReply(data, rowNumber);
    
    // お店への通知メール  
    sendShopNotification(data, rowNumber);
    
    return { success: true };
    
  } catch (error) {
    console.error('メール送信エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * お客様への自動返信メール
 */
function sendCustomerReply(data, rowNumber) {
  const subject = `【${SHOP_NAME}】ご予約ありがとうございます`;
  
  const menuString = formatMenuItems(data.menuItems);
  const totalAmount = calculateTotalAmount(data.menuItems);
  
  let pickupInfo = '';
  if (data.pickupDateTime && data.pickupDateTime !== 'null') {
    pickupInfo = `受け取り希望日時: ${formatPickupDateTime(data.pickupDateTime)}\n`;
  }
  
  const body = `
${data.name} 様

この度は${SHOP_NAME}にご予約いただき、誠にありがとうございます。
以下の内容でご予約を承りました。

■ ご予約内容
お名前: ${data.name}
メールアドレス: ${data.email}
お電話番号: ${data.phone}

ご注文内容: ${menuString}
合計金額: ${totalAmount.toLocaleString()}円
${pickupInfo}
${data.message ? `ご要望: ${data.message}\n` : ''}

■ 今後の流れ
1. こちらよりお電話にてご連絡いたします
2. 詳細な受け取り時間等を調整いたします  
3. 当日お受け取りをお願いします

■ お急ぎの場合
電話番号: 080-4613-9761
営業時間内にお気軽にお電話ください。

今後ともよろしくお願いいたします。

━━━━━━━━━━━━━━━━━━
${SHOP_NAME}
電話: 080-4613-9761
予約番号: R${String(rowNumber).padStart(4, '0')}
━━━━━━━━━━━━━━━━━━
`;

  GmailApp.sendEmail(data.email, subject, body);
  console.log('お客様への返信メール送信完了:', data.email);
}

/**
 * お店への通知メール
 */
function sendShopNotification(data, rowNumber) {
  const subject = `【新規予約】${data.name}様からのご予約 (R${String(rowNumber).padStart(4, '0')})`;
  
  const menuString = formatMenuItems(data.menuItems);
  const totalAmount = calculateTotalAmount(data.menuItems);
  
  const body = `
新しいお弁当のご予約が入りました。
Vercel経由での予約です。

■ お客様情報
お名前: ${data.name}
メールアドレス: ${data.email}
お電話番号: ${data.phone}

■ ご注文内容
${menuString}
合計金額: ${totalAmount.toLocaleString()}円

■ 受け取り希望
${data.pickupDateTime && data.pickupDateTime !== 'null' 
  ? formatPickupDateTime(data.pickupDateTime) 
  : '要相談'}

■ ご要望・備考
${data.message || 'なし'}

■ システム情報
予約番号: R${String(rowNumber).padStart(4, '0')}
受信日時: ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日 HH:mm:ss')}
ソース: Vercel (Instagram対応)
UserAgent: ${data.userAgent || '不明'}

━━━━━━━━━━━━━━━━━━
速やかにお客様にご連絡をお願いします。
スプレッドシート: ${SpreadsheetApp.openById(SPREADSHEET_ID).getUrl()}
━━━━━━━━━━━━━━━━━━
`;

  GmailApp.sendEmail(ADMIN_EMAIL, subject, body);
  console.log('店舗への通知メール送信完了:', ADMIN_EMAIL);
}

/**
 * 予約IDを生成
 */
function generateReservationId(rowNumber) {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
  return `${today}-R${String(rowNumber).padStart(4, '0')}`;
}

/**
 * 成功レスポンスを作成
 */
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

/**
 * エラーレスポンスを作成
 */
function createErrorResponse(message, statusCode = 500) {
  const errorData = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(errorData))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

/**
 * 定休日情報を取得する関数（元システムと同じ）
 * @returns {Array} 定休日の配列
 */
function getHolidayDates() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let holidaySheet = spreadsheet.getSheetByName('定休日');
    
    if (!holidaySheet) {
      // 定休日シートが存在しない場合は空配列を返す
      console.log('定休日シートが見つかりませんでした');
      return [];
    }
    
    // A列から日付データを取得（ヘッダー行をスキップ）
    const dataRange = holidaySheet.getRange('A2:A').getValues();
    const holidays = [];
    
    for (let i = 0; i < dataRange.length; i++) {
      const cellValue = dataRange[i][0];
      if (cellValue && cellValue instanceof Date) {
        // YYYY-MM-DD形式で格納
        const dateStr = Utilities.formatDate(cellValue, 'Asia/Tokyo', 'yyyy-MM-dd');
        holidays.push(dateStr);
      } else if (cellValue === '' || cellValue === null) {
        // 空行に到達したら終了
        break;
      }
    }
    
    console.log('取得した定休日:', holidays);
    return holidays;
    
  } catch (error) {
    console.error('定休日取得エラー:', error);
    return [];
  }
}

/**
 * 今日が定休日かチェックする
 * @returns {boolean} 定休日の場合true
 */
function checkIfTodayIsHoliday() {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  return isDateHoliday(today);
}

/**
 * 指定日が定休日かチェックする
 * @param {string} dateStr YYYY-MM-DD形式の日付文字列
 * @returns {boolean} 定休日の場合true
 */
function isDateHoliday(dateStr) {
  const holidays = getHolidayDates();
  return holidays.includes(dateStr);
}

/**
 * クライアント側から定休日リストを取得する（元システムと同じ）
 * @returns {Object} 定休日情報
 */
function getHolidayInfo() {
  return {
    isTodayHoliday: checkIfTodayIsHoliday(),
    holidays: getHolidayDates()
  };
}

/**
 * テスト用関数
 */
function testVercelBridge() {
  console.log('=== Vercel Bridge テスト開始 ===');
  
  const testData = {
    postData: {
      type: 'application/json',
      contents: JSON.stringify({
        name: 'テスト太郎',
        email: 'test@example.com',
        phone: '090-1234-5678',
        menuItems: {
          'daily': 2,
          'karaage': 1
        },
        pickupDateTime: '2024-01-01T12:00',
        message: 'テスト注文です',
        source: 'vercel'
      })
    }
  };
  
  const result = doPost(testData);
  console.log('テスト結果:', result.getContent());
  console.log('=== Vercel Bridge テスト完了 ===');
}

/**
 * 定休日情報取得テスト
 */
function testGetHolidayInfo() {
  console.log('=== 定休日情報取得テスト開始 ===');
  const holidayInfo = getHolidayInfo();
  console.log('定休日情報:', holidayInfo);
  console.log('=== 定休日情報取得テスト完了 ===');
}