'use client';

import { useState, FormEvent, useEffect } from 'react';

// 弁当メニューの定義（元システムと同じ）
const MENU_ITEMS = [
  { id: 'karaage', name: '唐揚げ弁当', price: 800 },
  { id: 'curry', name: '宮崎和牛カレー（極）', price: 850 },
  { id: 'chicken_nanban', name: 'チキン南蛮弁当', price: 800 },
  { id: 'tonkatsu', name: '宮崎ポークのとんかつ弁当', price: 850 },
  { id: 'ebi_fry', name: '大えびふらい弁当', price: 800 },
  { id: 'nori_bento', name: 'レザン風のり弁', price: 750 },
  { id: 'hamburg', name: '手ごねハンバーグ弁当', price: 880 },
  { id: 'tamago_sand', name: 'たまごサンドBOX', price: 700 }
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
  reviewBonus: boolean;
  reviewScreenshot?: File;
}

export default function BentoReservationForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    menuItems: {},
    pickupDate: '',
    pickupTime: '',
    message: '',
    reviewBonus: false
  });
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState<{
    isTodayHoliday: boolean;
    holidays: string[];
  }>({
    isTodayHoliday: false,
    holidays: []
  });

  // 定休日情報取得とモーダル制御
  useEffect(() => {
    const fetchHolidayInfo = async () => {
      try {
        const response = await fetch('/api/get-holiday-info');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setHolidayInfo({
              isTodayHoliday: result.data.isTodayHoliday || false,
              holidays: result.data.holidays || []
            });

            // 定休日の場合は当日予約締切モーダルを表示しない
            if (result.data.isTodayHoliday) {
              setShowTodayModal(false);
              return;
            }
          }
        }
      } catch (error) {
        console.error('定休日情報の取得に失敗:', error);
      }

      // 当日予約締切チェック（定休日でない場合のみ）
      const now = new Date();
      const currentHour = now.getHours();
      
      // 当日の9:00〜14:00の間のみモーダル表示
      if (currentHour >= 9 && currentHour < 14) {
        setShowTodayModal(true);
      }
    };

    fetchHolidayInfo();
  }, []);

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

  const closeTodayModal = () => {
    setShowTodayModal(false);
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

      // 定休日チェック
      if (formData.pickupDate && holidayInfo.holidays.includes(formData.pickupDate)) {
        throw new Error('ご指定の日は定休日です。別の日付をお選びください。');
      }

      // レビューSSファイルをBase64エンコード
      let reviewScreenshotData = null;
      if (formData.reviewScreenshot) {
        console.log('🖼️ レビューSSファイル検出:', {
          name: formData.reviewScreenshot.name,
          type: formData.reviewScreenshot.type,
          size: formData.reviewScreenshot.size
        });
        
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(formData.reviewScreenshot!);
        });
        
        reviewScreenshotData = {
          name: formData.reviewScreenshot.name,
          data: base64,
          mimeType: formData.reviewScreenshot.type,
          size: formData.reviewScreenshot.size
        };
        
        console.log('✅ Base64変換完了:', {
          name: reviewScreenshotData.name,
          mimeType: reviewScreenshotData.mimeType,
          size: reviewScreenshotData.size,
          dataLength: reviewScreenshotData.data.length,
          dataPreview: reviewScreenshotData.data.substring(0, 100) + '...'
        });
      } else {
        console.log('ℹ️ レビューSSファイルなし');
      }

      const requestData = {
        ...formData,
        reviewScreenshot: reviewScreenshotData
      };
      
      console.log('📤 送信データ:', {
        name: requestData.name,
        email: requestData.email,
        hasReviewScreenshot: !!requestData.reviewScreenshot,
        reviewScreenshotInfo: requestData.reviewScreenshot ? {
          name: requestData.reviewScreenshot.name,
          mimeType: requestData.reviewScreenshot.mimeType,
          dataLength: requestData.reviewScreenshot.data.length
        } : null
      });
      
      const res = await fetch('/api/submit-reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
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
        message: '',
        reviewBonus: false
      });

    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || '予期しないエラーが発生しました');
    }
  };

  const formStyle = {
    fontFamily: "'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif",
    backgroundColor: '#fef5e7',
    margin: 0,
    padding: '15px 5px',
    lineHeight: 1.6,
    minHeight: '100vh'
  };

  const containerStyle = {
    maxWidth: '900px',
    margin: '0 auto',
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #ecf0f1',
    borderRadius: '6px',
    fontSize: '16px',
    boxSizing: 'border-box' as const,
    transition: 'all 0.3s ease',
    backgroundColor: '#fafafa'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    color: '#2c3e50',
    fontWeight: 500,
    fontSize: '15px'
  };

  const submitBtnStyle = {
    backgroundColor: '#ff6b35',
    color: 'white',
    padding: '14px 32px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.3s ease',
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <>
      <div style={formStyle}>
        <div style={containerStyle}>
          {/* ヘッダー */}
          <div style={{
            textAlign: 'center',
            marginBottom: '40px',
            paddingBottom: '20px',
            borderBottom: '3px solid #ff6b35'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: '42px',
                fontWeight: 'bold',
                color: '#2c3e50',
                textAlign: 'center',
                lineHeight: 1.2,
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
              }}>惣菜屋レザン</div>
              <div style={{
                fontSize: '18px',
                color: '#7f8c8d',
                textAlign: 'center',
                marginBottom: '20px'
              }}>美味しい惣菜とお弁当のお店</div>
            </div>
            <h1 style={{
              color: '#2c3e50',
              margin: '10px 0',
              fontWeight: 600,
              fontSize: '28px'
            }}>お弁当のご予約</h1>
            <p style={{
              color: '#7f8c8d',
              margin: 0,
              fontSize: '14px',
              lineHeight: 1.5
            }}>
              いつもご利用ありがとうございます。<br/>
              以下のフォームからご予約をお願いいたします。
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 基本情報 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>
                お名前 <span style={{ color: '#e74c3c', marginLeft: '4px' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                style={inputStyle}
                placeholder="山田 太郎"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>
                メールアドレス <span style={{ color: '#e74c3c', marginLeft: '4px' }}>*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                style={inputStyle}
                placeholder="example@email.com"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>
                お電話番号 <span style={{ color: '#e74c3c', marginLeft: '4px' }}>*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                style={inputStyle}
                placeholder="090-1234-5678"
              />
            </div>

            <div style={{ borderTop: '2px solid #ecf0f1', margin: '30px 0' }}></div>

            {/* メニュー選択 */}
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3 style={{
                color: '#2c3e50',
                marginTop: 0,
                marginBottom: '15px',
                fontSize: '18px'
              }}>お弁当のご予約</h3>
              <p style={{
                color: '#6c757d',
                fontSize: '13px',
                marginTop: '5px'
              }}>複数のメニューを選択できます。不要なメニューは数量を0にしてください。</p>

              <div>
                {MENU_ITEMS.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: 'white',
                    border: '1px solid #ecf0f1',
                    borderRadius: '6px',
                    transition: 'all 0.3s ease'
                  }}>
                    <label style={{
                      margin: 0,
                      fontWeight: 500,
                      color: '#2c3e50',
                      flex: 1
                    }}>
                      {item.name}<br/>（{item.price}円）
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={formData.menuItems[item.id] || 0}
                      onChange={(e) => updateMenuQuantity(item.id, parseInt(e.target.value) || 0)}
                      style={{
                        width: '80px',
                        marginLeft: '15px',
                        textAlign: 'center',
                        padding: '8px',
                        border: '2px solid #ecf0f1',
                        borderRadius: '6px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '6px',
                marginTop: '15px',
                textAlign: 'center'
              }}>
                <p style={{
                  color: '#2c3e50',
                  fontSize: '16px',
                  marginBottom: '5px'
                }}>
                  <strong>合計数量: {calculateQuantity()}個</strong>
                </p>
                <p style={{
                  color: '#2c3e50',
                  fontSize: '16px',
                  marginBottom: '5px'
                }}>
                  <strong>合計金額: ¥{calculateTotal().toLocaleString()}</strong>
                </p>
                <p style={{
                  color: '#6c757d',
                  fontSize: '13px',
                  marginTop: '5px'
                }}>
                  ※10個以上のご注文は<br/>事前にお電話(080-4613-9761)でご相談ください
                </p>
              </div>

              {/* 受け取り日時 */}
              <div style={{ marginBottom: '24px', marginTop: '20px' }}>
                <label style={labelStyle}>
                  受け取り日付<span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.pickupDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickupDate: e.target.value }))}
                  style={inputStyle}
                />
                
                {/* 定休日表示 */}
                {holidayInfo.holidays.length > 0 && (
                  <div style={{
                    display: 'block',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    padding: '10px',
                    marginTop: '10px'
                  }}>
                    <strong style={{ color: '#dc3545' }}>定休日:</strong>
                    <div style={{
                      marginTop: '5px',
                      color: '#495057',
                      fontSize: '14px'
                    }}>
                      {holidayInfo.holidays.map((date, index) => {
                        const dateObj = new Date(date + 'T00:00:00');
                        const formattedDate = dateObj.toLocaleDateString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                          weekday: 'short'
                        });
                        return (
                          <span
                            key={index}
                            style={{
                              display: 'inline-block',
                              marginRight: '10px',
                              marginBottom: '5px'
                            }}
                          >
                            {formattedDate}
                          </span>
                        );
                      }).reduce((prev, curr, index) => {
                        if (index > 0 && (index % 4) === 0) {
                          return [...prev, <br key={`br-${index}`} />, curr];
                        }
                        return [...prev, curr];
                      }, [] as React.ReactNode[])}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>
                  受け取り時間<span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <select
                  required
                  value={formData.pickupTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickupTime: e.target.value }))}
                  style={{
                    ...inputStyle,
                    cursor: 'pointer',
                    appearance: 'none',
                    paddingRight: '40px'
                  }}
                >
                  <option value="">選択してください</option>
                  <option value="11:00">11:00</option>
                  <option value="11:30">11:30</option>
                  <option value="12:00">12:00</option>
                  <option value="12:30">12:30</option>
                  <option value="13:00">13:00</option>
                  <option value="13:30">13:30</option>
                  <option value="14:00">14:00</option>
                </select>
                <p style={{
                  marginTop: '5px',
                  color: '#666',
                  fontSize: '13px'
                }}>※受け取り時間: 11:00〜14:00</p>
              </div>
            </div>

            <div style={{ borderTop: '2px solid #ecf0f1', margin: '30px 0' }}></div>

            {/* Googleレビュー特典 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #ffd54f, #ffb74d)',
                color: '#e65100',
                marginBottom: '15px',
                padding: '15px',
                borderRadius: '8px'
              }}>
                <h4 style={{
                  margin: '0 0 8px 0',
                  fontSize: '18px'
                }}>ご利用いただいているお客様へ</h4>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: 1.5
                }}>
                  よろしければ、Googleのクチコミにてお店のご感想をお聞かせください。<br/>
                  「美味しかった。また利用したい！」などの感想をいただく機会が増え、本当に嬉しく思います。<br/>
                  投稿したレビューのスクリーンショットは、次回ご予約される際に以下から添付してください。
                </p>
              </div>

              <div style={{ margin: '15px 0' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500
                }}>
                  <input
                    type="checkbox"
                    checked={formData.reviewBonus}
                    onChange={(e) => setFormData(prev => ({ ...prev, reviewBonus: e.target.checked }))}
                    style={{
                      marginRight: '8px',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ color: '#2c3e50' }}>
                    Googleレビューのスクショを送る<br/>
                    <small style={{
                      color: '#7f8c8d',
                      fontWeight: 'normal'
                    }}>（お一人様1回限り・レビュー投稿済みの方のみ）</small>
                  </span>
                </label>
              </div>

              {formData.reviewBonus && (
                <div style={{
                  display: formData.reviewBonus ? 'block' : 'none',
                  marginTop: '15px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  borderLeft: '4px solid #ff6b35'
                }}>
                  <label style={labelStyle}>レビューのスクリーンショット</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormData(prev => ({ ...prev, reviewScreenshot: file }));
                      }
                    }}
                    style={{
                      width: 'fit-content',
                      padding: '8px',
                      border: '2px solid #ecf0f1',
                      borderRadius: '6px',
                      fontSize: '14px',
                      marginTop: '8px'
                    }}
                  />
                  <p style={{
                    marginTop: '8px',
                    color: '#6c757d',
                    fontSize: '13px'
                  }}>
                    💡 <strong>レビュー投稿済みの方へ：</strong>スクリーンショットをこちらにアップロードしてください。<br/>
                    ※ファイルサイズは5MB以下、画像形式（JPG, PNG, GIF, WebP）をお選びください
                  </p>
                </div>
              )}
            </div>

            {/* 備考欄 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>備考欄</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: '120px'
                }}
                placeholder="ご要望やアレルギーなどございましたらご記入ください"
              />
              <p style={{
                color: '#6c757d',
                fontSize: '13px',
                marginTop: '5px'
              }}>
                例：アレルギー：卵・乳製品
              </p>
            </div>

            {/* 会議用弁当案内 */}
            <div style={{
              backgroundColor: '#fff3cd',
              borderLeft: '4px solid #ffc107',
              padding: '10px',
              marginBottom: '20px',
              borderRadius: '6px'
            }}>
              <h3 style={{
                margin: '0 0 10px 0',
                color: '#856404',
                fontSize: '16px'
              }}>会議用弁当・大量注文の場合</h3>
              <p style={{
                margin: '5px 0',
                color: '#856404',
                fontSize: '14px',
                lineHeight: 1.6
              }}>以下の情報を「備考欄」にご記入ください：</p>
              <p style={{
                margin: '5px 0',
                color: '#856404',
                fontSize: '14px'
              }}>• ご希望の個数</p>
              <p style={{
                margin: '5px 0',
                color: '#856404',
                fontSize: '14px'
              }}>• 受け取りされる方のお名前</p>
              <p style={{
                margin: '5px 0',
                color: '#856404',
                fontSize: '14px'
              }}>• ご予算（1個あたり）</p>
              <p style={{
                color: '#6c757d',
                fontSize: '13px',
                marginTop: '5px'
              }}>
                記入例：会議用弁当30個、田中様受取、予算1,200円/個
              </p>
              <p style={{
                color: '#d63031',
                fontWeight: 'bold',
                fontSize: '14px',
                margin: '10px 0'
              }}>
                ※会議用弁当は1,000円〜承っております。詳細はお電話または備考欄にてご相談ください。
              </p>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                ...submitBtnStyle,
                opacity: status === 'loading' ? 0.5 : 1,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer'
              }}
            >
              {status === 'loading' ? (
                <span>
                  <span style={{
                    display: 'inline-block',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px',
                    verticalAlign: 'middle'
                  }}></span>
                  送信中...
                </span>
              ) : '送信する'}
            </button>
          </form>

          {/* 結果表示 */}
          {status === 'success' && (
            <div style={{
              backgroundColor: '#d4edda',
              color: '#155724',
              padding: '16px',
              borderRadius: '6px',
              marginTop: '20px',
              border: '1px solid #c3e6cb'
            }}>
              ご予約・お問い合わせありがとうございます。
            </div>
          )}

          {status === 'error' && (
            <div style={{
              backgroundColor: '#f8d7da',
              color: '#721c24',
              padding: '16px',
              borderRadius: '6px',
              marginTop: '20px',
              border: '1px solid #f5c6cb'
            }}>
              {errorMessage}
            </div>
          )}

        </div>
      </div>

      {/* 当日予約締切モーダル */}
      {showTodayModal && (
        <div style={{
          position: 'fixed',
          zIndex: 1000,
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            margin: '5% auto',
            padding: '20px',
            borderRadius: '12px',
            width: '85%',
            maxWidth: '450px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            boxSizing: 'border-box'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '2px solid #ff6b35'
            }}>
              <h2 style={{
                color: '#ff6b35',
                margin: 0,
                fontSize: '22px',
                fontWeight: 'bold'
              }}>当日のご予約について</h2>
              <div style={{
                color: '#666',
                fontSize: '14px',
                marginTop: '8px'
              }}>現在時刻: {new Date().toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}</div>
            </div>

            <div style={{
              textAlign: 'center',
              marginBottom: '25px',
              lineHeight: 1.6
            }}>
              <div style={{
                color: '#dc3545',
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '15px'
              }}>
                当日分の予約フォームでの受付は<br/>終了しています
              </div>

              <div style={{
                color: '#495057',
                fontSize: '14px',
                marginBottom: '20px'
              }}>
                当日分の予約フォームでの受付は<br/>9:00で終了させていただいております。
              </div>

              <div style={{
                backgroundColor: '#fff3cd',
                padding: '15px',
                borderRadius: '8px',
                borderLeft: '4px solid #ffc107',
                margin: '20px 0'
              }}>
                <strong style={{ color: '#856404' }}>当日のご注文をご希望の方は</strong><br/>
                お電話にてお問い合わせください<br/>
                <a href="tel:080-4613-9761" style={{
                  color: '#007bff',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginTop: '5px'
                }}>080-4613-9761</a>
              </div>

              <div style={{
                backgroundColor: '#e3f2fd',
                padding: '15px',
                borderRadius: '8px',
                borderLeft: '4px solid #2196F3',
                margin: '20px 0',
                color: '#1976d2'
              }}>
                <strong>翌日以降のご予約の方は</strong><br/>
                下記の「翌日以降で予約」ボタンを押して<br/>
                こちらの予約フォームよりお願いいたします
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                onClick={closeTodayModal}
                style={{
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  minWidth: '120px'
                }}
              >
                翌日以降で予約
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}