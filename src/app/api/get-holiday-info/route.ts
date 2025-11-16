import { NextRequest, NextResponse } from 'next/server';

// GAS WebアプリのURL
const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL || '';

export async function GET(req: NextRequest) {
  try {
    if (!GAS_WEBAPP_URL) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'GAS_WEBAPP_URL環境変数が設定されていません' 
        },
        { status: 500 }
      );
    }

    console.log('定休日情報を取得中...');

    // GAS WebアプリにGETリクエストを送信（定休日情報取得）
    const gasResponse = await fetch(`${GAS_WEBAPP_URL}?action=getHolidayInfo`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('GAS定休日レスポンス:', {
      status: gasResponse.status,
      statusText: gasResponse.statusText,
      headers: Object.fromEntries(gasResponse.headers.entries())
    });

    if (!gasResponse.ok) {
      const errorText = await gasResponse.text();
      console.error('GAS定休日 API エラー:', {
        status: gasResponse.status,
        body: errorText
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: '定休日情報の取得中にエラーが発生しました',
          details: `GAS API Error: ${gasResponse.status}`
        },
        { status: 502 }
      );
    }

    const gasResult = await gasResponse.json();
    console.log('GAS定休日処理結果:', gasResult);

    if (!gasResult.success) {
      console.error('GAS側で定休日情報取得エラーが発生:', gasResult);
      return NextResponse.json(
        { 
          success: false, 
          error: gasResult.error || '定休日情報の取得に失敗しました',
          details: 'GAS処理エラー'
        },
        { status: 500 }
      );
    }

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      data: gasResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Vercel定休日 API エラー:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'システムエラーが発生しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      },
      { status: 500 }
    );
  }
}

// OPTIONS メソッドの対応（CORS対応）
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}