# 🚀 弁当予約システム Vercel版 セットアップチェックリスト

## Instagram問題解決のため、あなたがやるべきこと

### 📋 STEP 1: Google Apps Script の設定

#### 1-1. 新しいGASプロジェクトを作成
- [ ] [Google Apps Script](https://script.google.com/) にアクセス
- [ ] 「新しいプロジェクト」を作成
- [ ] プロジェクト名を「弁当予約システム Vercel Bridge」に変更

#### 1-2. GASコードを配置
- [ ] `gas-vercel-bridge.gs` の内容を Code.gs にコピー&ペースト
- [ ] 以下の設定値を**必ず**変更：
  ```javascript
  const ADMIN_EMAIL = 'yoshihiroinokuchi876@gmail.com'; // ✅ 既に設定済み
  const SHOP_NAME = '惣菜屋レザン'; // ✅ 既に設定済み  
  const SPREADSHEET_ID = '1ZnxeHsGGMx9awxzK3eTqrrjtbWjphaEiA4Cs-eVq68Q'; // ❌ 要変更
  ```

### 📋 STEP 2: スプレッドシートの準備

#### 2-1. 新しいスプレッドシートを作成
- [ ] [Google スプレッドシート](https://sheets.google.com/) で新しいシートを作成
- [ ] シート名を「弁当予約データ_Vercel」に変更
- [ ] URLからスプレッドシートIDを取得（例：`1ABC...XYZ`の部分）
- [ ] GAS コードの `SPREADSHEET_ID` を実際の値に変更

#### 2-2. 権限設定
- [ ] スプレッドシートの共有設定で、あなたのGoogleアカウントに編集権限があることを確認

### 📋 STEP 3: GAS のデプロイ

#### 3-1. Webアプリとしてデプロイ
- [ ] GASエディタで「デプロイ」→「新しいデプロイ」
- [ ] 種類：「ウェブアプリ」を選択
- [ ] 実行ユーザー：「自分」を選択
- [ ] アクセス権限：「全員」を選択
- [ ] 「デプロイ」をクリック

#### 3-2. WebアプリURLを取得
- [ ] 生成されたWebアプリURL（`https://script.google.com/macros/s/.../exec`）をコピー
- [ ] このURLを安全な場所に保存

### 📋 STEP 4: Vercel プロジェクトの設定

#### 4-1. 環境変数の設定
- [ ] `.env.local` ファイルで `GAS_WEBAPP_URL` をSTEP 3-2で取得したURLに変更
  ```
  GAS_WEBAPP_URL=https://script.google.com/macros/s/実際のURL/exec
  ```

#### 4-2. ローカルテスト
- [ ] プロジェクトディレクトリで以下を実行：
  ```bash
  cd /Users/hashiguchimasaki/project/bento-reservation-vercel
  npm install
  npm run dev
  ```
- [ ] http://localhost:3000 でフォームが表示されることを確認

#### 4-3. テスト送信
- [ ] ローカル環境でテスト予約を送信
- [ ] スプレッドシートにデータが保存されることを確認
- [ ] メールが送信されることを確認

### 📋 STEP 5: Vercel にデプロイ

#### 5-1. Vercel アカウント準備
- [ ] [Vercel](https://vercel.com/) アカウントでログイン
- [ ] GitHubリポジトリにプロジェクトをプッシュ（オプション）

#### 5-2. Vercel デプロイ
- [ ] Vercelでプロジェクトをインポート
- [ ] 環境変数 `GAS_WEBAPP_URL` を本番環境に設定
- [ ] デプロイ完了後、本番URLを取得

#### 5-3. 本番テスト
- [ ] Vercel本番URLでフォーム動作確認
- [ ] 実際にテスト予約を送信して動作確認

### 📋 STEP 6: Instagram での活用

#### 6-1. URLの設定
- [ ] Vercel本番URL（例：`https://your-app.vercel.app`）をコピー
- [ ] Instagramプロフィールのリンクに設定
- [ ] または、linktr.ee などのリンク集サービスに追加

#### 6-2. Instagram動作確認
- [ ] iPhoneのInstagramアプリでリンクをタップ
- [ ] フォームが正常に表示されることを確認
- [ ] テスト送信して正常に動作することを確認

### 📋 STEP 7: 最終チェック

#### 7-1. 動作確認リスト
- [ ] PC ブラウザ：正常動作 ✅
- [ ] iPhone Safari：正常動作 ✅
- [ ] Android Chrome：正常動作 ✅  
- [ ] iPhone Instagram アプリ内ブラウザ：正常動作 ✅ ← **重要**

#### 7-2. 運用準備
- [ ] お客様への案内文を準備
- [ ] QRコードの生成（オプション）
- [ ] 従業員への説明・研修
- [ ] 既存の予約システムとの並行運用計画

---

## 🆘 困った時の対処法

### エラーが発生した場合
1. **GAS実行ログを確認**: Google Apps Script エディタ → 実行 → ログを表示
2. **Vercelログを確認**: Vercel Dashboard → Functions → Logs
3. **スプレッドシートを確認**: データが保存されているか確認

### よくある問題
- **「undefined」が表示される**: 既存GASと新しいVercel版が混在していないか確認
- **スプレッドシートにデータが保存されない**: SPREADSHEET_ID が正しく設定されているか確認
- **メールが送信されない**: ADMIN_EMAIL が正しく設定されているか確認

### 緊急時の対応
**システムが完全に動かない場合**:
- 電話予約に切り替え: 080-4613-9761
- Instagram投稿で電話予約のお願いを投稿
- 既存システムに一時的に戻す

---

## 📞 完了報告

すべてのSTEPが完了したら：
1. Vercel本番URLをご報告ください
2. Instagram経由での動作確認結果をご報告ください  
3. 何か問題があれば詳細をお知らせください

**🎉 完了予定：Instagram問題が完全に解決された弁当予約システムの運用開始！**