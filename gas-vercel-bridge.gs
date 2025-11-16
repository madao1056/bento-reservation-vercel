/**
 * Vercel連携用 Google Apps Script コード
 * 弁当予約システム Vercel Bridge
 */

// 設定: 管理者のメールアドレス（ここを変更してください）
const ADMIN_EMAIL = 'yoshihiroinokuchi876@gmail.com'; // お弁当屋さんのメールアドレスを設定
const SHOP_NAME = '惣菜屋レザン'; // お店の名前を設定

// スプレッドシートID（新しく作成したスプレッドシートのIDを設定）
const SPREADSHEET_ID = '1ZnxeHsGGMx9awxzK3eTqrrjtbWjphaEiA4Cs-eVq68Q'; // 実際のスプレッドシートIDに置き換えてください

// レビューファイル保存用フォルダID（Google Driveで作成したフォルダのIDを設定）
const REVIEW_FOLDER_ID = '19BMod76C7hFaE6dtZLoAj5qoioqeupHb'; // レビュースクリーンショット保存フォルダ

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
    
    // お礼メールのスケジュール設定
    scheduleThankYouEmail(requestData);
    
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
    let sheet = spreadsheet.getSheetByName('予約');
    
    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = spreadsheet.insertSheet('予約');
      // 元システムと同じヘッダー構成に設定
      sheet.getRange(1, 1, 1, 10).setValues([[
        '名前', 'メールアドレス', '電話番号', '注文内容', '合計金額', 
        '受け取り日時', '備考欄', 'レビューSS', '受信日時', 'ステータス'
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
    
    // レビュースクリーンショットの処理
    let reviewScreenshotUrl = 'なし';
    if (data.reviewScreenshot && data.reviewScreenshot.data) {
      reviewScreenshotUrl = saveReviewScreenshot(data.reviewScreenshot, data.email);
    }
    
    // データ行を追加（元システムのヘッダー順序に合わせる）
    const rowData = [
      data.name,                     // 名前
      data.email,                    // メールアドレス
      data.phone,                    // 電話番号
      menuString,                    // 注文内容
      totalAmount,                   // 合計金額
      pickupDateTime,                // 受け取り日時
      data.message || 'なし',        // 備考欄
      reviewScreenshotUrl,           // レビューSS
      new Date(),                    // 受信日時
      '未対応'                       // ステータス
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
 * メニューアイテムを文字列にフォーマット（元システムと同じ表示形式）
 */
function formatMenuItems(menuItems) {
  // 元システムのメニュー名と価格設定
  const menuData = {
    '唐揚げ弁当': 800,
    '宮崎和牛カレー（極）': 850,
    'チキン南蛮弁当': 800,
    '宮崎ポークのとんかつ弁当': 830,
    '大えびふらい弁当': 880,
    'レザン風のり弁': 780,
    '手ごねハンバーグ弁当': 820,
    'たまごサンドBOX': 580
  };
  
  const items = [];
  let totalQuantity = 0;
  let totalAmount = 0;
  
  for (const [itemId, quantity] of Object.entries(menuItems)) {
    if (quantity > 0) {
      const name = itemId;
      const price = menuData[itemId] || 0;
      const itemTotal = price * quantity;
      
      items.push(`${name} × ${quantity}個 (¥${price.toLocaleString()} × ${quantity} = ¥${itemTotal.toLocaleString()})`);
      totalQuantity += quantity;
      totalAmount += itemTotal;
    }
  }
  
  const itemsText = items.join('\n');
  const summary = `\n\n合計: ${totalQuantity}個 - ¥${totalAmount.toLocaleString()}`;
  
  return itemsText + summary;
}

/**
 * 合計金額を計算（元システムと同じ価格設定）
 */
function calculateTotalAmount(menuItems) {
  // 元システムの価格設定と一致させる
  const prices = {
    '唐揚げ弁当': 800,
    '宮崎和牛カレー（極）': 850,
    'チキン南蛮弁当': 800,
    '宮崎ポークのとんかつ弁当': 830,
    '大えびふらい弁当': 880,
    'レザン風のり弁': 780,
    '手ごねハンバーグ弁当': 820,
    'たまごサンドBOX': 580
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
 * お客様への自動返信メール（元システムと同じフォーマット）
 */
function sendCustomerReply(data, rowNumber) {
  const subject = `【${SHOP_NAME}】ご予約・お問い合わせを受付いたしました`;
  
  const formattedDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日 HH:mm:ss');
  
  const menuInfo = data.menuItems && Object.keys(data.menuItems).length > 0 ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; width: 30%;">ご注文内容</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; white-space: pre-line;">${formatMenuItems(data.menuItems)}</td>
            </tr>` : '';
  
  const pickupInfo = data.pickupDateTime && data.pickupDateTime !== 'null' ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">受け取り日時</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${formatPickupDateTime(data.pickupDateTime)}</td>
            </tr>` : '';
  
  const htmlBody = `
    <div style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ff6b35; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">ご予約・お問い合わせ受付完了</h1>
      </div>
      
      <div style="padding: 15px 10px; background-color: #fef5e7;">
        <p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">
          ${data.name} 様
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">
          この度は${SHOP_NAME}へご予約・お問い合わせをいただき、<br>
          誠にありがとうございます。
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">
          以下の内容で承りました。
        </p>
        
        <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #ff6b35; margin-top: 0;">ご予約内容</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; width: 30%;">お名前</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${data.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">メールアドレス</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${data.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">お電話番号</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${data.phone}</td>
            </tr>
            ${menuInfo}
            ${pickupInfo}
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; vertical-align: top;">備考欄</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; white-space: pre-wrap;">${data.message || 'なし'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold;">受付日時</td>
              <td style="padding: 10px;">${formattedDate}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fff3cd; padding: 12px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>今後の流れ</strong><br>
            ご予約内容を確認させていただき、準備を進めます。<br>
            受け取り日の変更がありましたら、お手数ですが下記までお電話ください。<br>
            <a href="tel:080-4613-9761" style="color: #007bff; text-decoration: none; font-weight: bold;">080-4613-9761</a>
          </p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">
          ご不明な点がございましたら、<br>
          お気軽にお問い合わせください。
        </p>
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #666;">
            ※このメールは自動送信されています。<br>
            ※このメールに返信いただいても、お返事できませんのでご了承ください。
          </p>
        </div>
      </div>
      
      <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
        <p style="margin: 5px 0; font-size: 14px;">${SHOP_NAME}</p>
        <p style="margin: 5px 0; font-size: 12px;">美味しいお弁当をお届けします</p>
      </div>
    </div>
  `;
  
  const textBody = `
${data.name} 様

この度は${SHOP_NAME}へご予約・お問い合わせをいただき、
誠にありがとうございます。

以下の内容で承りました。

【ご予約内容】
お名前: ${data.name}
メールアドレス: ${data.email}
お電話番号: ${data.phone}
${data.menuItems && Object.keys(data.menuItems).length > 0 ? 'ご注文内容: ' + formatMenuItems(data.menuItems) + '\n' : ''}${data.pickupDateTime && data.pickupDateTime !== 'null' ? '受け取り日時: ' + formatPickupDateTime(data.pickupDateTime) + '\n' : ''}備考欄: ${data.message || 'なし'}
受付日時: ${formattedDate}

ご予約内容を確認させていただき、準備を進めます。
受け取り日の変更がありましたら、お手数ですがお電話ください。

ご不明な点がございましたら、
お気軽にお問い合わせください。

${SHOP_NAME}

※このメールは自動送信されています。
※このメールに返信いただいても、お返事できませんのでご了承ください。
  `;
  
  // メール送信
  GmailApp.sendEmail(data.email, subject, textBody, {
    htmlBody: htmlBody,
    name: SHOP_NAME
  });
  
  console.log('お客様への自動返信メール送信完了:', data.email);
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
    .setMimeType(ContentService.MimeType.JSON);
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
    .setMimeType(ContentService.MimeType.JSON);
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
      // 定休日シートが存在しない場合は自動作成
      console.log('定休日シートが見つかりません。新しく作成します。');
      holidaySheet = createHolidaySheet(spreadsheet);
      if (!holidaySheet) {
        console.log('定休日シートの作成に失敗しました。空配列を返します。');
        return [];
      }
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
 * 定休日シートを作成する関数
 */
function createHolidaySheet(spreadsheet) {
  try {
    const holidaySheet = spreadsheet.insertSheet('定休日');
    
    // ヘッダーを設定
    holidaySheet.getRange('A1').setValue('定休日');
    holidaySheet.getRange('A1').setFontWeight('bold');
    
    // サンプル定休日を追加（年末年始）
    const sampleDates = [
      new Date('2025-12-29'),
      new Date('2025-12-30'), 
      new Date('2025-12-31'),
      new Date('2026-01-01')
    ];
    
    sampleDates.forEach((date, index) => {
      holidaySheet.getRange(index + 2, 1).setValue(date);
    });
    
    console.log('定休日シートを作成しました');
    return holidaySheet;
    
  } catch (error) {
    console.error('定休日シート作成エラー:', error);
    return null;
  }
}

/**
 * クライアント側から定休日リストを取得する（元システムと同じ）
 * @returns {Object} 定休日情報
 */
function getHolidayInfo() {
  try {
    const holidays = getHolidayDates();
    const isTodayHoliday = checkIfTodayIsHoliday();
    
    console.log('getHolidayInfo結果:', {
      isTodayHoliday: isTodayHoliday,
      holidays: holidays,
      holidayCount: holidays.length
    });
    
    return {
      isTodayHoliday: isTodayHoliday,
      holidays: holidays,
      debug: {
        spreadsheetId: SPREADSHEET_ID,
        timestamp: new Date().toISOString(),
        holidayCount: holidays.length
      }
    };
  } catch (error) {
    console.error('getHolidayInfo エラー:', error);
    return {
      isTodayHoliday: false,
      holidays: [],
      error: error.message,
      debug: {
        spreadsheetId: SPREADSHEET_ID,
        timestamp: new Date().toISOString(),
        errorMessage: error.message
      }
    };
  }
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

/**
 * スプレッドシートの全シート名を確認するテスト関数
 */
function checkSpreadsheetSheets() {
  console.log('=== スプレッドシート構成確認 ===');
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = spreadsheet.getSheets();
    
    console.log('スプレッドシート名:', spreadsheet.getName());
    console.log('シート数:', sheets.length);
    
    sheets.forEach((sheet, index) => {
      console.log(`シート${index + 1}: "${sheet.getName()}"`);
      
      // 各シートの基本情報も表示
      console.log(`  - 行数: ${sheet.getLastRow()}`);
      console.log(`  - 列数: ${sheet.getLastColumn()}`);
      
      // A1セルの内容を表示（ヘッダーの確認）
      if (sheet.getLastRow() > 0) {
        const a1Value = sheet.getRange('A1').getValue();
        console.log(`  - A1セル: "${a1Value}"`);
      }
    });
    
  } catch (error) {
    console.error('スプレッドシート確認エラー:', error);
  }
  console.log('=== スプレッドシート構成確認完了 ===');
}

/**
 * =================
 * お礼メール機能
 * =================
 */

/**
 * お礼メール送信のトリガーを設定する
 * @param {Object} formData - フォームデータ
 */
function scheduleThankYouEmail(formData) {
  try {
    if (!formData.pickupDateTime || formData.pickupDateTime === 'なし') {
      console.log('受け取り日時が設定されていないため、お礼メールのスケジュールをスキップします');
      return;
    }

    // 過去にレビューSS添付の履歴があるかチェック
    if (hasReviewHistoryForEmail(formData.email)) {
      console.log(`${formData.email} は過去にレビューSS添付済みのため、お礼メールをスキップします`);
      return;
    }
    
    // 今回の予約でレビューSS添付がある場合もスキップ
    if (formData.reviewScreenshot && formData.reviewScreenshot.data) {
      console.log(`${formData.email} は今回レビューSS添付済みのため、お礼メールをスキップします`);
      return;
    }

    // 受け取り日時を解析
    const pickupDate = new Date(formData.pickupDateTime);
    
    // 受け取り日の15:00に設定
    const thankYouDate = new Date(pickupDate);
    thankYouDate.setHours(15, 0, 0, 0);
    
    // 過去の日付の場合はスキップ
    if (thankYouDate < new Date()) {
      console.log('受け取り日が過去のため、お礼メールのスケジュールをスキップします');
      return;
    }
    
    // トリガー作成
    const triggerBuilder = ScriptApp.newTrigger('sendThankYouEmail')
      .timeBased()
      .at(thankYouDate);
    
    const trigger = triggerBuilder.create();
    
    // トリガー情報をスプレッドシートに保存
    saveTriggerInfo(trigger.getUniqueId(), formData, thankYouDate);
    
    console.log(`レビュー未投稿の ${formData.email} にお礼メールのトリガーを設定しました: ${thankYouDate}`);
    
  } catch (error) {
    console.error('お礼メールトリガー設定エラー:', error);
  }
}

/**
 * 指定メールアドレスに過去のレビューSS添付履歴があるかチェック
 * @param {string} email - チェックするメールアドレス
 * @returns {boolean} 過去にレビューSS添付履歴がある場合true
 */
function hasReviewHistoryForEmail(email) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const mainSheet = spreadsheet.getSheetByName('予約') || spreadsheet.getSheets()[0];
    const lastRow = mainSheet.getLastRow();
    
    if (lastRow <= 1) {
      return false;
    }
    
    // ヘッダー行を取得してレビューSS列の位置を特定
    const headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
    const emailColumnIndex = headers.indexOf('メールアドレス') + 1;
    const reviewSSColumnIndex = headers.indexOf('レビューSS') + 1;
    
    if (emailColumnIndex === 0 || reviewSSColumnIndex === 0) {
      console.log('メールアドレス列またはレビューSS列が見つかりません');
      return false;
    }
    
    // データ範囲を取得
    const emailData = mainSheet.getRange(2, emailColumnIndex, lastRow - 1, 1).getValues();
    const reviewSSData = mainSheet.getRange(2, reviewSSColumnIndex, lastRow - 1, 1).getValues();
    
    // 同じメールアドレスの行でレビューSS添付履歴をチェック
    for (let i = 0; i < emailData.length; i++) {
      if (emailData[i][0] === email) {
        const reviewSSValue = reviewSSData[i][0];
        if (reviewSSValue && reviewSSValue !== 'なし' && reviewSSValue !== '') {
          console.log(`${email} の過去のレビューSS添付履歴を発見: ${reviewSSValue} (${i + 2}行目)`);
          return true;
        }
      }
    }
    
    console.log(`${email} の過去のレビューSS添付履歴なし`);
    return false;
    
  } catch (error) {
    console.error('レビュー履歴チェックエラー:', error);
    return false;
  }
}

/**
 * トリガー情報をスプレッドシートに保存
 * @param {string} triggerId - トリガーID
 * @param {Object} formData - フォームデータ
 * @param {Date} scheduledTime - 送信予定時刻
 */
function saveTriggerInfo(triggerId, formData, scheduledTime) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let triggerSheet = spreadsheet.getSheetByName('お礼メールトリガー');
    
    if (!triggerSheet) {
      // トリガー管理用シートを作成
      triggerSheet = spreadsheet.insertSheet('お礼メールトリガー');
      
      // ヘッダー行を設定
      const headers = ['トリガーID', '顧客名', 'メールアドレス', '受け取り日時', 'お礼メール送信予定', '送信ステータス', '作成日時'];
      triggerSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // スタイル設定
      const headerRange = triggerSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#4CAF50');
      headerRange.setFontColor('white');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
    }
    
    // トリガー情報を追加
    const rowData = [
      triggerId,
      formData.name,
      formData.email,
      formatPickupDateTime(formData.pickupDateTime),
      Utilities.formatDate(scheduledTime, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      '予約済み',
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')
    ];
    
    triggerSheet.appendRow(rowData);
    
  } catch (error) {
    console.error('トリガー情報保存エラー:', error);
  }
}

/**
 * 実際にお礼メールを送信する（トリガーによって実行される）
 */
function sendThankYouEmail() {
  try {
    // 実行中のトリガーIDを取得
    const triggers = ScriptApp.getProjectTriggers();
    const currentTrigger = triggers.find(trigger => 
      trigger.getHandlerFunction() === 'sendThankYouEmail'
    );
    
    if (!currentTrigger) {
      console.log('対応するトリガーが見つかりません');
      return;
    }
    
    const triggerId = currentTrigger.getUniqueId();
    
    // スプレッドシートからトリガー情報を取得
    const triggerInfo = getTriggerInfo(triggerId);
    
    if (!triggerInfo) {
      console.log('トリガー情報が見つかりません');
      ScriptApp.deleteTrigger(currentTrigger);
      return;
    }
    
    // お礼メールを送信
    sendThankYouMailToCustomer(triggerInfo);
    
    // トリガー情報を更新
    updateTriggerStatus(triggerId, '送信完了');
    
    // トリガーを削除
    ScriptApp.deleteTrigger(currentTrigger);
    
    console.log('お礼メール送信完了:', triggerInfo.email);
    
  } catch (error) {
    console.error('お礼メール送信エラー:', error);
  }
}

/**
 * トリガー情報を取得
 * @param {string} triggerId - トリガーID
 * @returns {Object|null} トリガー情報
 */
function getTriggerInfo(triggerId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const triggerSheet = spreadsheet.getSheetByName('お礼メールトリガー');
    
    if (!triggerSheet) {
      return null;
    }
    
    const dataRange = triggerSheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === triggerId) {
        return {
          triggerId: values[i][0],
          name: values[i][1],
          email: values[i][2],
          pickupDateTime: values[i][3],
          scheduledTime: values[i][4],
          row: i + 1
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('トリガー情報取得エラー:', error);
    return null;
  }
}

/**
 * トリガーステータスを更新
 * @param {string} triggerId - トリガーID
 * @param {string} status - 新しいステータス
 */
function updateTriggerStatus(triggerId, status) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const triggerSheet = spreadsheet.getSheetByName('お礼メールトリガー');
    
    if (!triggerSheet) {
      return;
    }
    
    const dataRange = triggerSheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === triggerId) {
        triggerSheet.getRange(i + 1, 6).setValue(status);
        triggerSheet.getRange(i + 1, 7).setValue(
          Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')
        );
        break;
      }
    }
  } catch (error) {
    console.error('トリガーステータス更新エラー:', error);
  }
}

/**
 * レビュー特典情報を取得する
 * @returns {Object} レビュー特典情報
 */
function getReviewBonusInfo() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let reviewSheet = spreadsheet.getSheetByName('レビュー特典');
    
    if (!reviewSheet) {
      // レビュー特典シートが存在しない場合は作成
      reviewSheet = spreadsheet.insertSheet('レビュー特典');
      reviewSheet.getRange('A1').setValue('レビュー特典設定');
      reviewSheet.getRange('A2').setValue('レビューしていただけましたら');
      reviewSheet.getRange('B1').setValue('表示する');
      reviewSheet.getRange('B2').insertCheckboxes();
      reviewSheet.getRange('B2').setValue(false);
      
      console.log('レビュー特典シートを作成しました');
    }
    
    const message = reviewSheet.getRange('A2').getValue() || '';
    const isEnabled = reviewSheet.getRange('B2').getValue() === true;
    
    return {
      isEnabled: isEnabled,
      message: message
    };
  } catch (error) {
    console.error('レビュー特典情報取得エラー:', error);
    return {
      isEnabled: false,
      message: ''
    };
  }
}

/**
 * お客様へのお礼メールを送信
 * @param {Object} triggerInfo - トリガー情報
 */
function sendThankYouMailToCustomer(triggerInfo) {
  const subject = `【${SHOP_NAME}】お弁当をお受け取りいただきありがとうございました`;
  
  // レビュー特典情報を取得
  const reviewBonus = getReviewBonusInfo();
  
  const htmlBody = `
    <div style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ff6b35; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">お弁当のお受け取りありがとうございました</h1>
      </div>
      
      <div style="padding: 15px 10px; background-color: #fef5e7;">
        <p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">
          ${triggerInfo.name} 様
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">
          本日は${SHOP_NAME}のお弁当をお選びいただき、<br>
          誠にありがとうございました。
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #2c3e50;">
          お弁当はいかがでしたでしょうか？<br>
          お気に入りいただけましたら幸いです。
        </p>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 6px solid #2196F3; box-shadow: 0 3px 8px rgba(33, 150, 243, 0.2);">
          <h2 style="margin: 0 0 15px 0; color: #1976d2; font-size: 22px; font-weight: bold; text-align: center;">お客様のご感想をお聞かせください</h2>
          <p style="margin: 10px 0; color: #424242; font-size: 15px; text-align: center; line-height: 1.6;">
            より良いサービスを提供するため、Googleレビューでのご感想をお聞かせいただけますと幸いです。<br>
            皆様のお声が、私たちの励みとなります。
          </p>
          ${reviewBonus.isEnabled ? `
          <div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #fff3e0, #ffe0b2); border-radius: 12px; border: 2px solid #ff9800;">
            <h3 style="margin: 0 0 15px 0; color: #e65100; text-align: center; font-size: 18px;">レビュー特典のご案内</h3>
            <p style="margin: 10px 0; color: #e65100; font-size: 16px; text-align: center; line-height: 1.6; font-weight: bold;">
              レビューしていただけましたら${reviewBonus.message}
            </p>
            <div style="background-color: #fff; padding: 15px; border-radius: 8px; margin-top: 15px;">
              <h4 style="margin: 0 0 10px 0; color: #d84315; font-size: 16px;">特典の受け取り方法：</h4>
              <ol style="margin: 10px 0; padding-left: 20px; color: #5d4037; line-height: 1.8;">
                <li><strong>レビューを投稿</strong>してください</li>
                <li><strong>スクリーンショットを保存</strong>してください</li>
                <li>次回ご予約時に<strong>予約フォームでスクショをアップロード</strong>してください</li>
                <li>お受け取り時に<strong>特典をご用意</strong>いたします</li>
              </ol>
              <p style="margin: 10px 0; color: #ff5722; font-size: 14px; font-weight: bold; text-align: center;">
                ※お一人様1回限りの特典です
              </p>
            </div>
          </div>` : ''}
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://g.page/r/CejtxWTb6_cfEBM/review" 
               style="background-color: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);">
              Googleレビューを書く<br>
              <span style="color: #FFD700; font-size: 16px; display: block; margin-top: 5px;">☆☆☆☆☆</span>
            </a>
          </div>
        </div>
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #666;">
            ※このメールは自動送信されています。<br>
            ※このメールに返信いただいても、お返事できませんのでご了承ください。
          </p>
        </div>
      </div>
      
      <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
        <p style="margin: 5px 0; font-size: 14px;">${SHOP_NAME}</p>
        <p style="margin: 5px 0; font-size: 12px;">またのご利用をお待ちしております</p>
      </div>
    </div>
  `;
  
  const textBody = `
${triggerInfo.name} 様

本日は${SHOP_NAME}のお弁当をお選びいただき、
誠にありがとうございました。

お弁当はいかがでしたでしょうか？
お気に入りいただけましたら幸いです。

より良いサービスを提供するため、Googleレビューでのご感想をお聞かせいただけますと幸いです。
皆様のお声が、私たちの励みとなります。

Googleレビューはこちら:
https://g.page/r/CejtxWTb6_cfEBM/review

${SHOP_NAME}

※このメールは自動送信されています。
※このメールに返信いただいても、お返事できませんのでご了承ください。
  `;
  
  // メール送信
  GmailApp.sendEmail(triggerInfo.email, subject, textBody, {
    htmlBody: htmlBody,
    name: SHOP_NAME
  });
  
  console.log('お礼メール送信完了:', triggerInfo.email);
}

/**
 * アップロードされたファイルをGoogle Driveに保存
 * @param {Object} fileData - base64エンコードされたファイルデータ
 * @param {string} email - 顧客のメールアドレス
 * @returns {string} 保存されたファイルのURL
 */
function saveReviewScreenshot(fileData, email) {
  try {
    if (!fileData || !fileData.data) {
      return 'なし';
    }
    
    // base64データをデコード
    const base64Data = fileData.data.split(',')[1]; // data:image/jpeg;base64, の部分を除去
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileData.mimeType, fileData.name);
    
    // Google Driveフォルダを取得
    const folder = DriveApp.getFolderById(REVIEW_FOLDER_ID);
    
    // ファイル名を生成（日時とメールアドレスを含む）
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
    const fileName = `review_${timestamp}_${email.replace('@', '_at_')}_${fileData.name}`;
    
    // ファイルを保存
    const file = folder.createFile(blob);
    file.setName(fileName);
    
    // ファイルのURLを取得
    const fileUrl = file.getUrl();
    
    console.log('レビュースクリーンショット保存完了:', fileName);
    return fileUrl;
    
  } catch (error) {
    console.error('レビュースクリーンショット保存エラー:', error);
    return 'エラー: ' + error.message;
  }
}