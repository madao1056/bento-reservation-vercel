import { NextRequest, NextResponse } from 'next/server';

// GAS WebアプリのURL
const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL || '';

export async function GET(req: NextRequest) {
  try {
    console.log('=== 定休日API呼び出し開始 ===');
    console.log('GAS_WEBAPP_URL:', GAS_WEBAPP_URL ? '設定済み' : '未設定');
    
    if (!GAS_WEBAPP_URL) {
      console.error('GAS_WEBAPP_URL環境変数が設定されていません');
      return NextResponse.json(
        { 
          success: false, 
          error: 'GAS_WEBAPP_URL環境変数が設定されていません',
          debug: {
            hasGasUrl: !!GAS_WEBAPP_URL,
            env: process.env.NODE_ENV
          }
        },
        { status: 500 }
      );
    }

    const gasUrl = `${GAS_WEBAPP_URL}?action=getHolidayInfo`;
    console.log('リクエスト先URL:', gasUrl);

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

    // GASからの直接レスポンス、または success プロパティを含むレスポンス両方に対応
    const actualData = gasResult.success !== undefined ? gasResult : {
      success: true,
      isTodayHoliday: gasResult.isTodayHoliday || false,
      holidays: gasResult.holidays || [],
      debug: gasResult.debug
    };

    if (actualData.success === false) {
      console.error('GAS側で定休日情報取得エラーが発生:', actualData);
      return NextResponse.json(
        { 
          success: false, 
          error: actualData.error || '定休日情報の取得に失敗しました',
          details: 'GAS処理エラー',
          debug: actualData.debug
        },
        { status: 500 }
      );
    }

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      data: {
        isTodayHoliday: actualData.isTodayHoliday || false,
        holidays: actualData.holidays || [],
        debug: actualData.debug
      },
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