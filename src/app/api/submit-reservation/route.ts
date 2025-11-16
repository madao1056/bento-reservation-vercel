import { NextRequest, NextResponse } from 'next/server';

// GAS WebアプリのURL（ここに実際のURLを設定してください）
const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwBBjHDcPowXyBqXPgn6UMVKMw0cEUMcZnZIdjzwnbCWdy6vYft9iDTS61lNrSBo7K_jQ/exec';

interface MenuSelection {
  [key: string]: number;
}

interface RequestBody {
  name: string;
  email: string;
  phone: string;
  menuItems: MenuSelection;
  pickupDate: string;
  pickupTime: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    console.log('=== 予約API呼び出し開始 ===');
    console.log('GAS_WEBAPP_URL:', GAS_WEBAPP_URL ? '設定済み' : '未設定');
    
    const body: RequestBody = await req.json();
    
    // バリデーション
    if (!body.name || !body.email || !body.phone) {
      return NextResponse.json(
        { success: false, message: 'お名前、メールアドレス、電話番号は必須項目です。' },
        { status: 400 }
      );
    }
    
    if (!body.menuItems || Object.keys(body.menuItems).length === 0) {
      return NextResponse.json(
        { success: false, message: 'メニューを1つ以上選択してください。' },
        { status: 400 }
      );
    }
    
    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, message: '正しいメールアドレスを入力してください。' },
        { status: 400 }
      );
    }
    
    // 元のシステムのメニュー名に変換（完全一致）
    const convertedMenuItems: { [key: string]: number } = {};
    Object.entries(body.menuItems).forEach(([itemId, quantity]) => {
      const menuMap: { [key: string]: string } = {
        'karaage': '唐揚げ弁当',
        'curry': '宮崎和牛カレー（極）',
        'chicken_nanban': 'チキン南蛮弁当',
        'tonkatsu': '宮崎ポークのとんかつ弁当',
        'ebi_fry': '大えびふらい弁当',
        'nori_bento': 'レザン風のり弁',
        'hamburg': '手ごねハンバーグ弁当',
        'tamago_sand': 'たまごサンドBOX'
      };
      // メニュー名をそのまま使用（GAS側で正確に処理）
      const menuName = menuMap[itemId] || itemId;
      convertedMenuItems[menuName] = quantity;
    });

    // GASに送信するデータを整形
    const gasData = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      menuItems: convertedMenuItems,
      pickupDateTime: body.pickupDate && body.pickupTime 
        ? `${body.pickupDate}T${body.pickupTime}` 
        : null,
      message: body.message || '',
      source: 'vercel', // Vercel経由であることを示すフラグ
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent') || '',
      // Instagram検知用のリファラー情報も送信
      referer: req.headers.get('referer') || '',
      forwarded: req.headers.get('x-forwarded-for') || ''
    };
    
    console.log('GASに送信するデータ:', JSON.stringify(gasData, null, 2));
    
    if (!GAS_WEBAPP_URL) {
      console.error('GAS_WEBAPP_URL環境変数が設定されていません');
      return NextResponse.json(
        { 
          success: false, 
          message: 'システム設定エラー: GAS_WEBAPP_URLが設定されていません',
          details: 'ENV_MISSING'
        },
        { status: 500 }
      );
    }
    
    console.log('GAS URL:', GAS_WEBAPP_URL);
    
    // GAS WebアプリにPOSTリクエスト送信
    const gasResponse = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(gasData)
    });
    
    console.log('GASレスポンス:', {
      status: gasResponse.status,
      statusText: gasResponse.statusText,
      headers: Object.fromEntries(gasResponse.headers.entries())
    });
    
    if (!gasResponse.ok) {
      const errorText = await gasResponse.text();
      console.error('GAS API エラー:', {
        status: gasResponse.status,
        body: errorText
      });
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'データの保存中にエラーが発生しました。お電話でのご予約をお勧めします。',
          details: `GAS API Error: ${gasResponse.status}`
        },
        { status: 502 }
      );
    }
    
    const gasResult = await gasResponse.json();
    console.log('GAS処理結果:', gasResult);
    
    if (!gasResult.success) {
      console.error('GAS側でエラーが発生:', gasResult);
      return NextResponse.json(
        { 
          success: false, 
          message: gasResult.error || 'データの保存に失敗しました。',
          details: 'GAS処理エラー'
        },
        { status: 500 }
      );
    }
    
    // 成功レスポンス
    return NextResponse.json({
      success: true,
      message: 'ご予約を承りました。確認メールをお送りしています。',
      data: {
        timestamp: gasData.timestamp,
        reservationId: gasResult.reservationId || null
      }
    });
    
  } catch (error) {
    console.error('Vercel API エラー:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'システムエラーが発生しました。お電話でのご予約をお勧めします。',
        details: error instanceof Error ? error.message : '不明なエラー'
      },
      { status: 500 }
    );
  }
}

// OPTIONS メソッドの対応（CORS対応）
export async function OPTIONS(req: NextRequest) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}