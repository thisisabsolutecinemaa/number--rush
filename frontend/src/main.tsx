import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import SimHub from './SimHub';

declare global { interface Window { Telegram?: any } }
const tg = window.Telegram?.WebApp;
const API_URL = import.meta.env.VITE_API_URL || 'https://number-rush-api-1ywd.onrender.com';
tg?.ready();
tg?.expand();

type Tab = 'spin' | 'collection' | 'market' | 'chat' | 'generator' | 'rating' | 'news' | 'profile' | 'admin' | 'sim';
const regions = {
  UA:{flag:'🇺🇦',sample:'AA 0000 XX',name:'Украина',detail:'UA · ЕВРОПЕЙСКИЙ ФОРМАТ'},
  CN:{flag:'🇨🇳',sample:'京 A·88888',name:'Китай',detail:'CN · КИТАЙСКИЙ ФОРМАТ'},
  RU:{flag:'🇷🇺',sample:'А 000 АА 77',name:'Россия',detail:'RU · РОССИЙСКИЙ ФОРМАТ'},
  EU:{flag:'🇪🇺',sample:'AB · 123 · CD',name:'Европа',detail:'EU · ЕВРОПЕЙСКИЙ ФОРМАТ'},
  DE:{flag:'🇩🇪',sample:'B AB 1234',name:'Германия',detail:'DE · НЕМЕЦКИЙ ФОРМАТ'},
  US:{flag:'🇺🇸',sample:'8ABC123',name:'США',detail:'US · АМЕРИКАНСКИЙ ФОРМАТ'},
  GB:{flag:'🇬🇧',sample:'AB12 CDE',name:'Британия',detail:'GB · БРИТАНСКИЙ ФОРМАТ'},
  FR:{flag:'🇫🇷',sample:'AB-123-CD',name:'Франция',detail:'FR · ФРАНЦУЗСКИЙ ФОРМАТ'},
  JP:{flag:'🇯🇵',sample:'品川 300 あ 12-34',name:'Япония',detail:'JP · ЯПОНСКИЙ ФОРМАТ'},
  PL:{flag:'🇵🇱',sample:'WX 12345',name:'Польша',detail:'PL · ПОЛЬСКИЙ ФОРМАТ'},
  AE:{flag:'🇦🇪',sample:'5 12345',name:'ОАЭ',detail:'AE · ФОРМАТ ЭМИРАТОВ'}
};

function App() {
  const [balance,setBalance]=React.useState(100000);
  const [result,setResult]=React.useState<any>(null);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [tab,setTab]=React.useState<Tab>('sim');
  const [country,setCountry]=React.useState<keyof typeof regions>('UA');
  const [inventory,setInventory]=React.useState<any[]>([]);
  const [showChoice,setShowChoice]=React.useState(false);
  const [notice,setNotice]=React.useState('');
  const initData=tg?.initData || '';
  const user=tg?.initDataUnsafe?.user;
  const [adminData,setAdminData]=React.useState<any>(null);
  const [eventCatalog,setEventCatalog]=React.useState<any[]>([]);
  const [eventSearch,setEventSearch]=React.useState('');
  const [eventDuration,setEventDuration]=React.useState('30');
  const [globalEvents,setGlobalEvents]=React.useState<any[]>([]);
  const [grantId,setGrantId]=React.useState('');
  const [grantAmount,setGrantAmount]=React.useState('100000');
  const [chatMessages,setChatMessages]=React.useState<any[]>([]);
  const [chatText,setChatText]=React.useState('');
  const [marketListings,setMarketListings]=React.useState<any[]>([]);
  const [listingPrice,setListingPrice]=React.useState('50000');
  const [listingItem,setListingItem]=React.useState('');
  const [generatorArea,setGeneratorArea]=React.useState('');
  const [leaderboard,setLeaderboard]=React.useState<any[]>([]);
  const [progress,setProgress]=React.useState<any>(null);
  const [announcements,setAnnouncements]=React.useState<any[]>([]);
  const [announcementTitle,setAnnouncementTitle]=React.useState('');
  const [announcementBody,setAnnouncementBody]=React.useState('');
  const isAdmin=String(user?.id||'')==='8415813092';
  async function loadAdmin(){const r=await fetch(API_URL+'/api/admin',{headers:{'X-Telegram-Init-Data':initData},cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Нет доступа');setAdminData(d);}
  async function startEvent(type:string){const r=await fetch(API_URL+'/api/admin/event',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({event_type:type,duration_minutes:Math.max(1,Math.min(1440,Number(eventDuration)||30))})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Ошибка эвента');return;}setNotice('Запущено: '+d.title);const ev=await fetch(API_URL+'/api/events',{cache:'no-store'});if(ev.ok){const ed=await ev.json();setGlobalEvents(ed.events||[]);}await loadAdmin();}
  async function stopEvents(){const r=await fetch(API_URL+'/api/admin/event/stop',{method:'POST',headers:{'X-Telegram-Init-Data':initData}});const d=await r.json();if(!r.ok){setNotice(d.detail||'Ошибка');return;}setNotice('Все эвенты остановлены');setGlobalEvents([]);await loadAdmin();}
  async function grantBalance(){const r=await fetch(API_URL+'/api/admin/grant',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({telegram_id:Number(grantId),amount:Number(grantAmount)})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Не удалось начислить');return;}setNotice('Начислено. Баланс: '+d.balance.toLocaleString('ru-RU')+' ₽');}

  React.useEffect(()=>{if(tab!=='chat'||!initData)return;const timer=window.setInterval(()=>{fetch(API_URL+'/api/chat',{headers:{'X-Telegram-Init-Data':initData},cache:'no-store'}).then(r=>r.ok?r.json():{messages:[]}).then(d=>setChatMessages(d.messages||[])).catch(()=>{});},5000);return()=>window.clearInterval(timer);},[tab,initData]);


  React.useEffect(()=>{
    if(!initData) return;
    fetch(`${API_URL}/api/me`,{headers:{'X-Telegram-Init-Data':initData},cache:'no-store'})
      .then(r=>r.ok?r.json():null).then(d=>{if(d?.balance!==undefined)setBalance(d.balance)}).catch(()=>{});
  },[initData]);

  React.useEffect(()=>{
    if(tab==='admin'&&isAdmin&&initData){loadAdmin().catch(e=>setNotice(e.message));return;}
    if(tab==='news'){fetch(API_URL+'/api/announcements').then(r=>r.ok?r.json():{announcements:[]}).then(d=>setAnnouncements(d.announcements||[])).catch(()=>{});return;}
    if(!initData)return;
    if(tab==='chat'){fetch(API_URL+'/api/chat',{headers:{'X-Telegram-Init-Data':initData}}).then(r=>r.ok?r.json():{messages:[]}).then(d=>setChatMessages(d.messages||[])).catch(()=>{});return;}
    if(tab==='market'){Promise.all([fetch(API_URL+'/api/market',{headers:{'X-Telegram-Init-Data':initData}}),fetch(API_URL+'/api/inventory',{headers:{'X-Telegram-Init-Data':initData}})]).then(async ([a,b])=>{const x=await a.json(),y=await b.json();setMarketListings(x.listings||[]);setInventory(Array.isArray(y)?y:[]);}).catch(()=>{});return;}
    if(tab==='rating'){Promise.all([fetch(API_URL+'/api/leaderboard',{headers:{'X-Telegram-Init-Data':initData}}),fetch(API_URL+'/api/progress',{headers:{'X-Telegram-Init-Data':initData}})]).then(async ([a,b])=>{const x=await a.json(),y=await b.json();setLeaderboard(x.players||[]);setProgress(y);}).catch(()=>{});return;}
    if(tab!=='collection')return;
    fetch(`${API_URL}/api/inventory`,{headers:{'X-Telegram-Init-Data':initData},cache:'no-store'})
      .then(r=>r.ok?r.json():[]).then(d=>setInventory(Array.isArray(d)?d:[])).catch(()=>setInventory([]));
  },[tab,initData]);

  async function sendChat(){if(!chatText.trim())return;const r=await fetch(API_URL+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({message:chatText})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Не удалось отправить');return;}setChatText('');const x=await fetch(API_URL+'/api/chat',{headers:{'X-Telegram-Init-Data':initData},cache:'no-store'});if(x.ok)setChatMessages((await x.json()).messages||[]);}
  async function generateNumber(){const r=await fetch(API_URL+'/api/generator',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({region:country,area:generatorArea||null})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Ошибка генератора');return;}setBalance(d.balance);setNotice('Создан номер '+d.code+' — добавлен в гараж');await refreshGarage();}
  async function createListing(){if(!listingItem)return;const r=await fetch(API_URL+'/api/market',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({item_id:Number(listingItem),price:Number(listingPrice)})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Не удалось выставить номер');return;}setNotice('Номер выставлен на рынок');setListingItem('');const x=await fetch(API_URL+'/api/market',{headers:{'X-Telegram-Init-Data':initData}});if(x.ok)setMarketListings((await x.json()).listings||[]);}
  async function buyListing(id:number){const r=await fetch(API_URL+'/api/market/buy',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({listing_id:id})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Покупка не удалась');return;}setBalance(d.balance);setNotice('Покупка успешна');const x=await fetch(API_URL+'/api/market',{headers:{'X-Telegram-Init-Data':initData}});if(x.ok)setMarketListings((await x.json()).listings||[]);}
  async function resetGarage(){if(!window.confirm('Удалить ВСЕ номера из гаража без возврата?'))return;const r=await fetch(API_URL+'/api/garage/reset',{method:'POST',headers:{'X-Telegram-Init-Data':initData}});const d=await r.json();if(!r.ok){setNotice(d.detail||'Не удалось очистить гараж');return;}setInventory([]);setNotice('Гараж очищен. Удалено номеров: '+d.deleted);}
  async function claimTask(taskId:string){const r=await fetch(API_URL+'/api/tasks/claim',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({task_id:taskId})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Не удалось получить награду');return;}setBalance(d.balance);setNotice('Получено '+d.reward.toLocaleString('ru-RU')+' ₽');const x=await fetch(API_URL+'/api/progress',{headers:{'X-Telegram-Init-Data':initData}});if(x.ok)setProgress(await x.json());}
  async function publishAnnouncement(){const r=await fetch(API_URL+'/api/announcements',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({title:announcementTitle,body:announcementBody})});const d=await r.json();if(!r.ok){setNotice(d.detail||'Не удалось опубликовать');return;}setAnnouncementTitle('');setAnnouncementBody('');setNotice('Объявление опубликовано');}

  async function spin(){
    if(busy)return;
    if(!initData){setError('Открой Nomerki из Telegram, чтобы играть и сохранять номера.');return;}
    setBusy(true);setError('');setResult(null);
    try{
      const response=await fetch(`${API_URL}/api/spin`,{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':initData},body:JSON.stringify({region:country}),cache:'no-store'});
      const raw=await response.text();
      let data:any;
      try{data=JSON.parse(raw)}catch{throw new Error('Сервер прислал неправильный ответ. Попробуй ещё раз.')}
      if(!response.ok)throw new Error(data.detail||'Не удалось открыть номер');
      setResult(data);setBalance(data.balance);setShowChoice(true);tg?.HapticFeedback?.notificationOccurred('success');
    }catch(e:any){setError(e.message||'Не удалось подключиться к серверу')}
    finally{setBusy(false)}
  }

  async function refreshGarage(){
    const response=await fetch(API_URL+"/api/inventory",{headers:{"X-Telegram-Init-Data":initData},cache:"no-store"});
    if(response.ok){const data=await response.json();setInventory(Array.isArray(data)?data:[]);}
  }

  async function sellItem(itemId:number){
    const response=await fetch(API_URL+"/api/sell",{method:"POST",headers:{"Content-Type":"application/json","X-Telegram-Init-Data":initData},body:JSON.stringify({item_id:itemId})});
    const data=await response.json();
    if(!response.ok){setNotice(data.detail||"Не удалось продать номер");return;}
    setBalance(data.balance);setNotice("Продано за "+data.amount.toLocaleString("ru-RU")+" ₽");await refreshGarage();
  }

  async function sellAll(){
    if(!window.confirm("Продать все номера в гараже, кроме экипированных талисманов?"))return;
    const response=await fetch(API_URL+"/api/sell-all",{method:"POST",headers:{"X-Telegram-Init-Data":initData},cache:"no-store"});
    const data=await response.json();
    if(!response.ok){setNotice(data.detail||"Не удалось продать номера");return;}
    setBalance(data.balance);setNotice("Продано номеров: "+data.sold+". Получено "+data.amount.toLocaleString("ru-RU")+" ₽");await refreshGarage();
  }

  const nav:{id:Tab;symbol:string;label:string}[]=[
    {id:'sim',symbol:'▣',label:'SIM'},
    {id:'spin',symbol:'◉',label:'Крутка'},
    {id:'collection',symbol:'▤',label:'Гараж'},
    {id:'generator',symbol:'⌘',label:'Генератор'},
    {id:'market',symbol:'◆',label:'Рынок'},
    {id:'chat',symbol:'✉',label:'Чат'},
    {id:'rating',symbol:'♧',label:'Рейтинг'},
    {id:'news',symbol:'▣',label:'Новости'},
    {id:'profile',symbol:'●',label:'Профиль'},...(isAdmin?[{id:'admin' as Tab,symbol:'⚡',label:'ADMIN'}]:[])
  ];

  return <main className="app-shell">
    <header className="topbar">
      <div className="app-icon">NM</div>
      <div className="brand-copy"><b>Nomerki</b><small>Plate collection</small></div>
      <div className="online-pill"><i/> Онлайн</div>
    </header>

    <section className="wallet-card">
      <div className="wallet-top"><span>МОЙ БАЛАНС</span><span className="wallet-mark">₽</span></div>
      <div className="wallet-amount">{balance.toLocaleString('ru-RU')} <small>₽</small></div>
      <div className="wallet-bottom"><span>Игровые рубли</span><span>NOMERKI WALLET</span></div>
    </section>


    {tab==='spin'&&<section className="spin-view">
      <div className="welcome"><span className="eyebrow">КОЛЛЕКЦИОНИРУЙ НОМЕРА СО ВСЕГО МИРА</span><h1>Найди свой<br/><span>особенный номер.</span></h1><p>Редкие комбинации, красивые номера и настоящие коллекционные экземпляры.</p></div>
      <div className="section-row"><b>Регион</b><span>Выбери страну</span></div>
      <div className="region-picker">
        {(Object.keys(regions) as (keyof typeof regions)[]).map(code=><button key={code} className={country===code?'region-option active':'region-option'} onClick={()=>setCountry(code)}><span>{regions[code].flag}</span><b>{code}</b></button>)}
      </div>
      <div className="plate-card">
        <div className="plate-card-head"><span>ПРИМЕР НОМЕРА</span><span>ОБРАЗЕЦ</span></div>
        <div className={`plate plate-${country.toLowerCase()}`}><div className="plate-country"><span>{regions[country].flag}</span><small>{country}</small></div><strong>{regions[country].sample}</strong><i className="plate-bolt left"/><i className="plate-bolt right"/></div>
        <div className="plate-caption"><b>{regions[country].name}</b><span>{regions[country].detail}</span></div>
      </div>
      <div className="chance-card"><div><span className="chance-icon">✦</span><div><b>Редкие находки</b><small>Чем выше редкость, тем ценнее номер</small></div></div><span className="chance-arrow">›</span></div>
      <button className="spin-button" onClick={spin} disabled={busy}><span>{busy?'ОТКРЫВАЕМ…':'ПРОКРУТИТЬ'}</span><b>{busy?'…':'5 000 ₽'}</b></button>
      <div className="spin-caption">10 ПРОКРУТОК — 50 000 ₽ <span>•</span> СЛУЧАЙНЫЙ РЕЗУЛЬТАТ</div>
      {error&&<div className="notice error">{error}</div>}
      {result&&<div className="result-card"><div className="result-check">✓</div><div><small>НОВЫЙ НОМЕР В КОЛЛЕКЦИИ</small><h2>{result.code}</h2><b>{result.rarity} · {result.region}</b></div></div>}
    </section>}

    {tab==='collection'&&<section className="page-view"><div className="page-title"><span className="eyebrow">ТВОИ НАХОДКИ</span><h1>Гараж</h1><p>Храни, продавай и собирай коллекцию номеров.</p></div>{inventory.length>0&&<button className="sell-all-button" onClick={sellAll}>ПРОДАТЬ ВСЁ НЕЭКИПИРОВАННОЕ</button>}<button className="garage-reset" onClick={resetGarage}>ОЧИСТИТЬ ГАРАЖ</button>{notice&&<div className="notice">{notice}</div>}{inventory.length?<div className="inventory-list">{inventory.map(item=><div className="inventory-item" key={item.item_id}><div className="inventory-plate">{item.code}</div><div className="inventory-info"><b>{item.rarity}</b><small>{item.region} · {item.category}</small><small>{item.equipped?"Экипирован":"Цена продажи: "+({ "Обычный":500,"Необычный":1500,"Редкий":5000,"Эпический":15000,"Легендарный":50000,"Мифический":150000,"Секретный":500000,"Абсолют":1000000 }[item.rarity]||500).toLocaleString("ru-RU")+" ₽"}</small></div>{!item.equipped&&<button className="sell-item-button" onClick={()=>sellItem(item.item_id)}>Слить</button>}</div>)}</div>:<div className="empty-state"><div className="empty-icon">▤</div><b>Здесь пока пусто</b><p>Твои новые номера будут появляться здесь после прокрутки.</p><button onClick={()=>setTab('spin')}>ОТКРЫТЬ ПЕРВЫЙ НОМЕР</button></div>}</section>}
    {tab==='generator'&&<section className="page-view"><div className="page-title"><span className="eyebrow">CUSTOM PLATE LAB</span><h1>Генератор</h1><p>Создай новый случайный номер и добавь его в гараж за 15 000 ₽.</p></div><div className="admin-section"><b>Страна / формат</b><div className="region-picker">{(Object.keys(regions) as (keyof typeof regions)[]).map(code=><button key={code} className={country===code?'region-option active':'region-option'} onClick={()=>setCountry(code)}><span>{regions[code].flag}</span><b>{code}</b></button>)}</div><input value={generatorArea} onChange={e=>setGeneratorArea(e.target.value.toUpperCase().slice(0,4))} placeholder="Код региона Украины (необязательно)"/><button onClick={generateNumber}>СГЕНЕРИРОВАТЬ · 15 000 ₽</button></div>{notice&&<div className="notice">{notice}</div>}</section>}
    {tab==='market'&&<section className="page-view"><div className="page-title"><span className="eyebrow">NOMERKI EXCHANGE</span><h1>Рынок</h1><p>Покупай и продавай коллекционные номера. Комиссия площадки — 5%.</p></div><div className="admin-section"><b>Выставить свой номер</b><select value={listingItem} onChange={e=>setListingItem(e.target.value)}><option value="">Выбери номер из гаража</option>{inventory.filter(x=>!x.equipped).map(x=><option key={x.item_id} value={x.item_id}>{x.code} · {x.rarity}</option>)}</select><input value={listingPrice} onChange={e=>setListingPrice(e.target.value)} inputMode="numeric" placeholder="Цена в ₽"/><button onClick={createListing} disabled={!listingItem}>ВЫСТАВИТЬ НА РЫНОК</button></div><div className="market-list">{marketListings.length?marketListings.map(x=><div className="market-row" key={x.id}><div><b>{x.code}</b><small>{x.rarity} · {x.region} · @{x.seller}</small></div><strong>{Number(x.price).toLocaleString('ru-RU')} ₽</strong><button disabled={String(x.seller_id)===String(user?.id)} onClick={()=>buyListing(x.id)}>{String(x.seller_id)===String(user?.id)?'ТВОЁ':'КУПИТЬ'}</button></div>):<div className="empty-state"><b>Пока нет объявлений</b><p>Будь первым, кто выставит номер.</p></div>}</div>{notice&&<div className="notice">{notice}</div>}</section>}
    {tab==='chat'&&<section className="page-view"><div className="page-title"><span className="eyebrow">LIVE COMMUNITY</span><h1>Глобальный чат</h1><p>Общайся с коллекционерами со всего мира. Антиспам: 3 секунды между сообщениями.</p></div><div className="chat-feed">{chatMessages.map(x=><div className="chat-message" key={x.id}><b>@{x.username}</b><p>{x.message}</p></div>)}</div><div className="chat-compose"><input value={chatText} onChange={e=>setChatText(e.target.value)} maxLength={500} placeholder="Напиши сообщение…"/><button onClick={sendChat}>➤</button></div>{notice&&<div className="notice">{notice}</div>}</section>}
    {tab==='rating'&&<section className="page-view"><div className="page-title"><span className="eyebrow">NOMERKI COMMUNITY</span><h1>Рейтинг</h1><p>Лучшие коллекционеры по размеру гаража и балансу.</p></div><div className="market-list">{leaderboard.map((x,i)=><div className="market-row" key={x.telegram_id}><div><b>#{i+1} · @{x.username}</b><small>{x.items} номеров</small></div><strong>{Number(x.balance).toLocaleString('ru-RU')} ₽</strong></div>)}</div><div className="admin-section"><b>Достижения</b>{(progress?.achievements||[]).map((x:any)=><div className="progress-row" key={x.id}><span>{x.done?'✓':'○'} {x.title}</span><b>{x.done?'ПОЛУЧЕНО':'ЗАКРЫТО'}</b></div>)}</div><div className="admin-section"><b>Задания</b>{(progress?.tasks||[]).map((x:any)=><div className="progress-row" key={x.id}><span>{x.title}<small>{x.progress}/{x.target} · награда {x.reward.toLocaleString('ru-RU')} ₽</small></span><div className="task-actions">{x.can_claim?<button onClick={()=>claimTask(x.id)}>ЗАБРАТЬ {x.reward.toLocaleString('ru-RU')} ₽</button>:<b>{x.claimed?'ПОЛУЧЕНО':x.done?'ГОТОВО':'В ПРОЦЕССЕ'}</b>}</div></div>)}</div></section>}
    {tab==='news'&&<section className="page-view"><div className="page-title"><span className="eyebrow">NOMERKI BULLETIN</span><h1>Объявления</h1><p>Новости проекта, важные сообщения и обновления.</p></div>{announcements.map(x=><div className="announcement-card" key={x.id}><b>{x.title}</b><p>{x.body}</p><small>{x.created_at?new Date(x.created_at).toLocaleString('ru-RU'):''}</small></div>)}</section>}
    {tab==='admin'&&isAdmin&&<section className="page-view admin-view"><div className="page-title"><span className="eyebrow">ROOT ACCESS · ADMIN</span><h1>Панель управления</h1><p>Управление игровой экономикой. Все операции проверяются сервером.</p></div><div className="admin-stats"><div><small>ИГРОКИ</small><b>{adminData?.players??'—'}</b></div><div><small>КАРТЫ В КОЛЛЕКЦИЯХ</small><b>{adminData?.items??'—'}</b></div></div><div className="admin-section"><b>Выдать игровые рубли</b><input value={grantId} onChange={e=>setGrantId(e.target.value)} placeholder="Telegram ID игрока" inputMode="numeric"/><input value={grantAmount} onChange={e=>setGrantAmount(e.target.value)} placeholder="Сумма" inputMode="numeric"/><button onClick={grantBalance} disabled={!grantId||Number(grantAmount)<=0}>НАЧИСЛИТЬ ₽</button></div><div className="admin-section"><b>Объявления</b><input value={announcementTitle} onChange={e=>setAnnouncementTitle(e.target.value)} placeholder="Заголовок"/><textarea value={announcementBody} onChange={e=>setAnnouncementBody(e.target.value)} placeholder="Текст объявления"/><button onClick={publishAnnouncement} disabled={!announcementTitle.trim()||!announcementBody.trim()}>ОПУБЛИКОВАТЬ</button></div><div className="admin-section"><b>Операторы</b><small>Создание и включение собственных операторов доступно во вкладке SIM-карты.</small><button onClick={()=>setTab('sim')}>УПРАВЛЯТЬ ОПЕРАТОРАМИ</button></div>{notice&&<div className="notice">{notice}</div>}</section>}{tab==='sim'&&<SimHub apiUrl={API_URL} initData={initData} isAdmin={isAdmin} onBalance={setBalance}/>}
    {tab==='profile'&&<section className="page-view"><div className="page-title"><span className="eyebrow">ТВОЙ АККАУНТ</span><h1>Профиль</h1><p>Информация о твоём игровом аккаунте.</p></div><div className="profile-card"><div className="profile-avatar">{(user?.first_name||'N').slice(0,1).toUpperCase()}</div><b>{user?.first_name||'Коллекционер'}</b><small>@{user?.username||'nomerki_player'}</small><div className="profile-divider"/><div className="profile-line"><span>Баланс</span><b>{balance.toLocaleString('ru-RU')} ₽</b></div><div className="profile-line"><span>Статус</span><b className="profile-status">Участник клуба</b></div></div></section>}

      {showChoice&&result&&<div className="choice-overlay"><div className="choice-sheet"><div className="choice-handle"/><span className="eyebrow">НОМЕР ПОЛУЧЕН</span><h2>{result.code}</h2><p>{result.rarity} · {result.region}</p><button className="choice-sell" onClick={()=>{sellItem(result.item_id);setShowChoice(false)}}>СЛИТЬ ЗА {Number(result.sell_value||0).toLocaleString("ru-RU")} ₽</button><button className="choice-garage" onClick={()=>{setShowChoice(false);setTab("collection");refreshGarage()}}>В ГАРАЖ</button></div></div>}
    <nav className="bottom-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'nav-item selected':'nav-item'} onClick={()=>setTab(item.id)}><span>{item.symbol}</span><small>{item.label}</small></button>)}</nav>
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
