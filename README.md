# 惣菜屋レザン 弁当予約システム (Vercel版)

Instagram iOS アプリ内ブラウザ問題を完全に回避する Vercel + GAS 構成の弁当予約システムです。

## 🎯 システム構成

```
Instagram → Vercel (Next.js) → Vercel API → Google Apps Script → スプレッドシート
```

この構成により、Instagram アプリ内ブラウザの制限を完全に回避できます。

## 🚀 セットアップ手順

詳しくは **SETUP-CHECKLIST.md** をご確認ください。

### 概要
1. Google Apps Script の設定
2. スプレッドシートの作成
3. GAS のデプロイ
4. Vercel の設定
5. Vercel にデプロイ
6. Instagram での利用

## 📱 Instagram 対応

### 解決した問題
- ❌ Instagram iOS アプリ内ブラウザでの「undefined」表示
- ❌ JavaScript制限によるフォーム送信不可
- ❌ CORS エラー
- ❌ GAS WebView 相性問題

### 対策
- ✅ Vercel フロントエンドで安定表示
- ✅ サーバーサイド API で GAS 呼び出し
- ✅ Instagram 検知とログ記録
- ✅ エラー時の電話案内

---

**Instagram経由でも安心してご利用いただける弁当予約システム**