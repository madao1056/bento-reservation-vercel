'use client';

import { useState, FormEvent } from 'react';

// 弁当メニューの定義
const MENU_ITEMS = [
  { id: 'daily', name: '日替わり弁当', price: 500 },
  { id: 'karaage', name: '唐揚げ弁当', price: 550 },
  { id: 'fish', name: '焼き魚弁当', price: 600 },
  { id: 'hamburg', name: 'ハンバーグ弁当', price: 650 },
  { id: 'makunouchi', name: '幕の内弁当', price: 800 },
  { id: 'special', name: '特製弁当', price: 1000 },
  { id: 'meeting', name: '会議用弁当', price: 0 }, // 要相談
  { id: 'other', name: 'その他カスタム注文', price: 0 }
];

interface MenuSelection {
  [key: string]: number;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  menuItems: MenuSelection;
  pickupDate: string;
  pickupTime: string;
  message: string;
}

export default function BentoReservationForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    menuItems: {},
    pickupDate: '',
    pickupTime: '',
    message: ''
  });
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // 合計金額計算
  const calculateTotal = () => {
    return Object.entries(formData.menuItems).reduce((total, [itemId, quantity]) => {
      const item = MENU_ITEMS.find(m => m.id === itemId);
      return total + (item ? item.price * quantity : 0);
    }, 0);
  };

  // 合計数量計算
  const calculateQuantity = () => {
    return Object.values(formData.menuItems).reduce((sum, quantity) => sum + quantity, 0);
  };

  // メニュー数量変更
  const updateMenuQuantity = (itemId: string, quantity: number) => {
    const newMenuItems = { ...formData.menuItems };
    if (quantity <= 0) {
      delete newMenuItems[itemId];
    } else {
      newMenuItems[itemId] = quantity;
    }
    setFormData(prev => ({ ...prev, menuItems: newMenuItems }));
  };

  // フォーム送信処理
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      // バリデーション
      if (!formData.name || !formData.email || !formData.phone) {
        throw new Error('お名前、メールアドレス、電話番号は必須項目です。');
      }

      if (Object.keys(formData.menuItems).length === 0) {
        throw new Error('メニューを1つ以上選択してください。');
      }

      const res = await fetch('/api/submit-reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'サーバーエラーが発生しました');
      }

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.message || '予約の保存に失敗しました');
      }

      setStatus('success');
      // フォームリセット
      setFormData({
        name: '',
        email: '',
        phone: '',
        menuItems: {},
        pickupDate: '',
        pickupTime: '',
        message: ''
      });

    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || '予期しないエラーが発生しました');
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">🍱 惣菜屋レザン</h1>
          <p className="text-lg text-gray-600 mb-2">お弁当のご予約・お問い合わせ</p>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg inline-block">
            <p className="text-sm text-blue-700">
              📱 Instagram経由でも安心してご利用いただけます
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本情報 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">基本情報</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="田中太郎"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  お電話番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="090-1234-5678"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="example@email.com"
              />
            </div>
          </div>

          {/* メニュー選択 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">メニュー選択 <span className="text-red-500">*</span></h2>
            
            <div className="grid gap-4">
              {MENU_ITEMS.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{item.name}</h3>
                    <p className="text-sm text-gray-600">
                      {item.price === 0 ? '要相談' : `${item.price.toLocaleString()}円`}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => updateMenuQuantity(item.id, (formData.menuItems[item.id] || 0) - 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      disabled={!formData.menuItems[item.id]}
                    >
                      -
                    </button>
                    
                    <span className="w-8 text-center">{formData.menuItems[item.id] || 0}</span>
                    
                    <button
                      type="button"
                      onClick={() => updateMenuQuantity(item.id, (formData.menuItems[item.id] || 0) + 1)}
                      className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center hover:bg-orange-300"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 合計表示 */}
            <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-800">合計数量: {calculateQuantity()}個</span>
                <span className="font-bold text-lg text-orange-600">
                  合計金額: {calculateTotal().toLocaleString()}円
                </span>
              </div>
              {calculateTotal() === 0 && calculateQuantity() > 0 && (
                <p className="text-sm text-orange-600 mt-2">
                  ※ 要相談メニューが含まれています。お電話でご相談ください。
                </p>
              )}
            </div>
          </div>

          {/* 受け取り日時 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">受け取り日時</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  受け取り日
                </label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickupDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  受け取り時間
                </label>
                <input
                  type="time"
                  value={formData.pickupTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickupTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* その他・ご要望 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">その他・ご要望</h2>
            
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder={`アレルギー情報、会議用弁当の詳細、特別なご要望などがございましたらお書きください。

会議用弁当の場合は以下をご記入ください：
• ご希望の個数
• ご予算（1個あたり）
• 会議の種類・時間
• 特別なご要望`}
            />
          </div>

          {/* 送信ボタン */}
          <div className="text-center">
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-8 py-4 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? '送信中...' : 'ご予約を送信する'}
            </button>
          </div>
        </form>

        {/* 結果表示 */}
        {status === 'success' && (
          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                ✅ ご予約ありがとうございました！
              </h3>
              <p className="text-green-700 mb-4">
                お客様のご予約を承りました。確認のメールをお送りしておりますのでご確認ください。
              </p>
              <div className="bg-white p-4 rounded border border-green-200">
                <p className="text-sm text-green-700">
                  📞 お急ぎの場合やご質問がございましたら<br />
                  <strong>080-4613-9761</strong> までお電話ください
                </p>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                ❌ エラーが発生しました
              </h3>
              <p className="text-red-700 mb-4">{errorMessage}</p>
              <div className="bg-white p-4 rounded border border-red-200">
                <p className="text-sm text-red-700">
                  お手数をおかけして申し訳ございません。<br />
                  お電話でのご予約も承っております：<br />
                  <strong>080-4613-9761</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>📱 Instagram経由でも安全にご利用いただけます</p>
          <p>Powered by Vercel + Google Apps Script</p>
        </div>
      </div>
    </div>
  );
}
