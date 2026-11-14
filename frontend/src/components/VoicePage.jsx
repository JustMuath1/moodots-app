import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogoMark } from './Logo';
import { LockMark } from './ProSheet';
import { PRO_PRICE_SAR, HUB_URL } from '../utils/pro';
import qrcode from 'qrcode-generator';

// The Matter setup QR code, drawn as dots in the app's style (scannable by Alexa, Apple Home, Google Home).
function SetupQR({ text, size = 132 }) {
  if (!text) return null;
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const cell = size / (n + 4);
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (q.isDark(y, x)) out.push(<rect key={`${x}-${y}`} x={(x + 2) * cell} y={(y + 2) * cell} width={cell + 0.3} height={cell + 0.3} />);
  }
  return (
    <svg className="vc-qr" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Matter setup QR code">
      <rect width={size} height={size} rx="10" fill="#fff" />
      <g fill="#111">{out}</g>
    </svg>
  );
}

// Voice control (Pro): Alexa devices, recipe voice names, shortcuts, safety and the log.
// Design: nuqta-voice-handoff. Basic Alexa status stays free; the rest is locked without Pro.
const TX = {
  en: {
    title: 'Voice control', sub: 'Nuqta · voice commands and shortcuts', back: 'Settings',
    tabs: { overview: 'Overview', devices: 'Devices', recipes: 'Recipes', shortcuts: 'Shortcuts', safety: 'Safety', log: 'Log' },
    vc: 'Voice control', on: 'On', off: 'Off', seen: 'Devices Alexa can see', last: 'Last command', none: 'None yet',
    mConnected: 'Machine connected', mOff: 'Machine not connected', mAsleep: 'Machine asleep', mBrewing: 'Brewing',
    bOff: 'Nothing is offered to Alexa yet. Choose your devices first, then send them.', turnOn: 'Choose devices',
    send: (n) => `Send to Alexa · ${n}`, sendNone: 'Choose at least one', stopSend: 'Stop offering', sentHint: 'Sent. Now in the Alexa app: Add device → Discover.',
    offOn: 'Offered to Alexa', offOff: 'Not offered yet',
    bHelper: 'The voice add-on (Matter) is not installed on this computer.', howInstall: 'How to install',
    helperHow: 'On the computer running Nuqta, run the Nuqta installer again (it needs Node.js). Then restart Nuqta.',
    bDisc: 'The machine is not connected over Bluetooth. Voice commands will be refused.', connect: 'Connect',
    bAsleep: 'The machine is asleep. Wake it, or say "Alexa, turn on coffee machine".', wake: 'Wake',
    bBrew: (r) => `Brewing ${r || ''}. Any new brew is refused until it ends.`, stop: 'Stop',
    alexa: 'Amazon Alexa', apple: 'Apple Home', google: 'Google Home', connected: 'Connected', notSetUp: 'Not set up', later: 'Coming later',
    alexaHow: 'Works today. Discover devices in the Alexa app, on the same Wi-Fi.',
    appleHow: 'Pair with the same setup code in the Home app. Needs an Apple TV or HomePod as home hub.',
    googleHow: 'Pair with the same setup code in the Google Home app. Needs a Nest speaker, Nest Hub or Google TV Streamer as hub.',
    close: 'Close', ready: 'Ready to pair', pairApple: 'Add Nuqta to Apple Home', pairGoogle: 'Add Nuqta to Google Home',
    openPair: 'Open pairing', pairOpen: 'Pairing is open · 15 min', pairClosed: 'Pairing closed', pairFirst: 'Pair with Alexa first, or pair here directly.',
    ap0: 'You need an Apple TV or HomePod set as your home hub (Home app → ⋯ → Home Settings → Home Hubs & Bridges). Without one, the Home app won’t let you select Nuqta.',
    ap1: 'Press “Open pairing” below.', ap2: 'iPhone Home app → + → Add Accessory → scan the QR code, or More options… → enter the code.', ap3: 'When it warns “Uncertified accessory”, choose Add Anyway.',
    ap4: 'Away from home, Apple Home needs an Apple TV or HomePod.',
    gp0: 'You need a Google hub for Matter: a Nest speaker (Nest Mini, Nest Audio), a Nest Hub, Nest Wifi Pro or a Google TV Streamer. Without one, Google Home stops at “You need a hub”.',
    gp1: 'Press “Open pairing” below.', gp2: 'Google Home app → Devices → + Add → Matter-enabled device → scan the QR code, or set up without it and enter the code.', gp3: 'Choose a room and finish.',
    gp4: 'If Google says it can’t connect, the test version of Nuqta isn’t allowed in Google Home yet; tell us.',
    pairedApps: (n) => `${n} app${n === 1 ? '' : 's'} paired`,
    rediscover: 'Re-discover devices', rediscovered: 'Devices refreshed. In the Alexa app: Add device → Discover.', setUp: 'Set up',
    steps: 'Set up in three steps', s1: 'Choose your devices on the Devices tab, then press Send to Alexa', s2: 'Alexa app: Devices → + → Add Device → Matter → enter the setup code below', s3: 'Say: "Alexa, turn on coffee"',
    pairTitle: 'Setup code', pairSub: 'Enter it in the Alexa app (also works in Apple Home and Google Home).', paired: 'Paired', notPaired: 'Not paired yet', starting: 'Starting…',
    changed: 'Recipes changed. Run Discover devices in Alexa again.', done: 'Done',
    defCoffee: 'Default coffee', defSub: 'What “Alexa, turn on coffee” brews', recent: 'Recent commands', logLink: 'Log',
    proTitle: 'Nuqta Pro', proSub: 'A complete voice control centre. One tap to set up, updated for you.',
    pf: ['A voice name for every recipe', 'Pick your default coffee', 'Siri and NFC shortcuts', 'Safety options and activity log', 'Apple Home and Google Home when they arrive'],
    price: 'SAR · one-time · for life', getPro: 'Get Nuqta Pro', locked: 'This part is in Nuqta Pro',
    hSpoken: 'Spoken name', hOn: 'When turned on', hOff: 'When turned off', hState: 'State', momentary: 'Momentary', same: 'Same',
    dev: {
      coffee: ['Coffee', '“Alexa, turn on coffee”', 'Brew the selected recipe', 'Stop the brew'],
      pause: ['Coffee Pause', '“Alexa, turn on coffee pause”', 'Pause the brew', 'Resume'],
      water: ['Hot Water', '“Alexa, turn on hot water”', (s) => `Pour ${s.water_ml} ml at ${s.water_temp}°`, 'Stop'],
      grind: ['Grinder', '“Alexa, turn on grinder”', (s) => `Start grinding, stops after ${s.grind_s} s`, 'Stop'],
      scale: ['Scale', '“Alexa, turn on scale”', 'Zero the scale', null],
      wake: ['Coffee Machine', '“Alexa, turn on coffee machine”', 'Wake the machine', null],
    },
    chooseTitle: 'Choose what Alexa gets', chooseSub: 'Only what is switched on here is sent to Alexa. Choose first, then run Discover in the Alexa app.',
    gFunctions: 'Machine', gRecipes: 'Recipes', brewIt: (n) => `Brew ${n}`, nameFirst: 'Give it a spoken name first', editNames: 'Names and order',
    chosen: (n) => `${n} chosen`, sendHint: 'Changed. In the Alexa app: Add device → Discover.',
    fresh: 'Start fresh', freshTitle: 'Remove everything from Alexa and set it up again',
    fresh1: 'Press Reset below. Every Nuqta device gets a new identity, so the old ones in Alexa stop answering.',
    fresh2: 'In the Alexa app, open Devices and delete the old Nuqta devices. They show as “Device is unresponsive”.',
    fresh3: 'Choose what you want on the Devices tab, then in the Alexa app: Add device → Discover.',
    freshBtn: 'Reset devices', freshDone: 'Reset. Old devices no longer answer. Delete them in the Alexa app, then Discover.', cancel: 'Cancel',
    chk: 'Connection check', chkSub: 'Live. Shows how far Alexa gets.',
    chk1: 'Paired with Alexa', chk1h: 'Add Nuqta in the Alexa app with the setup code.',
    chk2: 'Alexa checked a device', chk2h: 'Open Devices in the Alexa app and pull down to refresh.',
    chk3: 'Alexa sent a command', chk3h: 'Tap a device in the Alexa app, or say “Alexa, turn on coffee machine”.',
    notYet: 'Not yet', ago: (s) => (s < 60 ? `${s} s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`),
    sending: 'Alexa is being offered:',
    recCmds: 'Recipe commands', enabledOf: (a) => `${a} of 10 enabled`, recLink: 'Recipes',
    recTitle: 'Recipe voice commands', of10: 'of 10', star: '★ = default coffee', typeName: 'Type a name in English letters',
    pArabic: 'Arabic name may not be spoken', pEmoji: 'Emoji cannot be spoken', pEmpty: 'Needs a spoken name', pDup: 'Name already used',
    emptySlot: 'Empty slot · filled from your recipes', noRec: 'No recipes yet', noRecSub: 'Add a recipe and it appears here as a voice command you can name.', addRec: 'Add a recipe',
    up: 'Move up', down: 'Move down', makeDefault: 'Make default',
    scHint: 'Paste the address into Apple Shortcuts, Siri, an NFC tag or Home Assistant. Works on the same Wi-Fi only.', copy: 'Copy', copied: 'Copied',
    sc: { brew: 'Brew', stop: 'Stop', pause: 'Pause', tare: 'Zero the scale', wake: 'Wake the machine', 'hot-water': 'Hot water', grind: 'Grind' },
    safety: 'Safety options', ask: 'Ask on the dashboard before a voice brew starts', askSub: 'Shows “Is your cup in place?” and brews once you approve.',
    grindS: 'Stop grinding automatically after', grindSub: 'Protects the grinder if you forget to stop it.',
    wMl: 'Hot water amount', wMlSub: 'What “Hot Water” pours.', wT: 'Hot water temperature', wTSub: 'In degrees Celsius.', s: 's', ml: 'ml',
    know: 'Good to know', knowText: 'Voice commands are not confirmed by voice: with no cup in place it still brews. A brew never starts while another is running.',
    src: { alexa: 'Alexa', shortcut: 'Shortcut' }, ok: 'Done', refused: 'Refused', noLog: 'No commands yet. They appear here as Alexa or a shortcut sends them.',
    act: { brew: (r) => `Brew ${r || ''}`.trim(), stop: () => 'Stop', pause: () => 'Pause', resume: () => 'Resume', water: () => 'Hot water', water_stop: () => 'Stop hot water', grind: () => 'Grind', grind_stop: () => 'Stop grinding', tare: () => 'Zero the scale', wake: () => 'Wake the machine' },
    why: { brew_running: 'Brew already running', not_connected: 'Machine not connected', voice_off: 'Voice control is off', device_off: 'Device turned off', cancelled: 'Cancelled on the dashboard', no_recipe: 'No recipe' },
    today: 'Today', yest: 'Yest.',
  },
  ar: {
    title: 'التحكم الصوتي', sub: 'نقطة · الأوامر الصوتية والاختصارات', back: 'الإعدادات',
    tabs: { overview: 'نظرة عامة', devices: 'الأجهزة', recipes: 'الوصفات', shortcuts: 'الاختصارات', safety: 'الأمان', log: 'السجل' },
    vc: 'التحكم الصوتي', on: 'يعمل', off: 'متوقف', seen: 'أجهزة يراها Alexa', last: 'آخر أمر', none: 'لا يوجد بعد',
    mConnected: 'المكنة متصلة', mOff: 'المكنة غير متصلة', mAsleep: 'المكنة نائمة', mBrewing: 'تحضير جارٍ',
    bOff: 'لا شيء معروض على Alexa بعد. اختر أجهزتك أولاً ثم أرسلها.', turnOn: 'اختر الأجهزة',
    send: (n) => `أرسل إلى Alexa · ${n}`, sendNone: 'اختر جهازاً واحداً على الأقل', stopSend: 'إيقاف العرض', sentHint: 'تم الإرسال. الآن في تطبيق Alexa: إضافة جهاز ← اكتشاف.',
    offOn: 'معروضة على Alexa', offOff: 'غير معروضة بعد',
    bHelper: 'إضافة الصوت (Matter) غير مثبّتة على هذا الكمبيوتر.', howInstall: 'كيف أثبّتها',
    helperHow: 'على الكمبيوتر الذي يشغّل نقطة، شغّل مثبّت نقطة مرة أخرى (يحتاج Node.js). ثم أعد تشغيل نقطة.',
    bDisc: 'المكنة غير متصلة بالبلوتوث. الأوامر الصوتية ستُرفض.', connect: 'اتصال',
    bAsleep: 'المكنة نائمة. أيقظها أو قل «Alexa, turn on coffee machine».', wake: 'إيقاظ',
    bBrew: (r) => `تحضير جارٍ: ${r || ''}. أي تحضير جديد سيُرفض حتى ينتهي.`, stop: 'إيقاف',
    alexa: 'Amazon Alexa', apple: 'Apple Home', google: 'Google Home', connected: 'متصل', notSetUp: 'غير مُعدّ', later: 'قريباً',
    alexaHow: 'يعمل اليوم. اكتشف الأجهزة من تطبيق Alexa على نفس الواي فاي.',
    appleHow: 'اقترن بنفس رمز الإعداد في تطبيق Home. يحتاج Apple TV أو HomePod كمركز للمنزل.',
    googleHow: 'اقترن بنفس رمز الإعداد في تطبيق Google Home. يحتاج سماعة Nest أو Nest Hub أو Google TV Streamer كمركز.',
    close: 'إغلاق', ready: 'جاهز للاقتران', pairApple: 'أضف نقطة إلى Apple Home', pairGoogle: 'أضف نقطة إلى Google Home',
    openPair: 'افتح الاقتران', pairOpen: 'الاقتران مفتوح · 15 دقيقة', pairClosed: 'الاقتران مغلق', pairFirst: 'اقترن مع Alexa أولاً، أو اقترن هنا مباشرة.',
    ap0: 'تحتاج Apple TV أو HomePod مضبوطاً كمركز للمنزل (تطبيق Home ← ⋯ ← إعدادات المنزل ← مراكز المنزل والجسور). بدونه لن يسمح تطبيق Home باختيار نقطة.',
    ap1: 'اضغط «افتح الاقتران» بالأسفل.', ap2: 'تطبيق Home على iPhone ← + ← إضافة ملحق ← امسح رمز QR، أو خيارات أخرى… ← أدخل الرمز.', ap3: 'عند تحذير «ملحق غير معتمد» اختر «إضافة على أي حال».',
    ap4: 'خارج المنزل يحتاج Apple Home إلى Apple TV أو HomePod.',
    gp0: 'تحتاج مركز Google لـ Matter: سماعة Nest (Nest Mini أو Nest Audio) أو Nest Hub أو Nest Wifi Pro أو Google TV Streamer. بدونه يتوقف Google Home عند «تحتاج إلى مركز».',
    gp1: 'اضغط «افتح الاقتران» بالأسفل.', gp2: 'تطبيق Google Home ← الأجهزة ← + إضافة ← جهاز يدعم Matter ← امسح رمز QR، أو أكمل بدونه وأدخل الرمز.', gp3: 'اختر الغرفة وأنهِ الإعداد.',
    gp4: 'إن قال Google إنه لا يستطيع الاتصال، فالنسخة التجريبية من نقطة غير مسموحة في Google Home بعد؛ أخبرنا.',
    pairedApps: (n) => `${n} تطبيق مقترن`,
    rediscover: 'إعادة اكتشاف الأجهزة', rediscovered: 'تم تحديث الأجهزة. في تطبيق Alexa: إضافة جهاز ← اكتشاف.', setUp: 'إعداد',
    steps: 'الإعداد في ثلاث خطوات', s1: 'اختر أجهزتك من تبويب الأجهزة، ثم اضغط «أرسل إلى Alexa»', s2: 'تطبيق Alexa: الأجهزة ← + ← إضافة جهاز ← Matter ← أدخل رمز الإعداد أدناه', s3: 'قل: «Alexa, turn on coffee»',
    pairTitle: 'رمز الإعداد', pairSub: 'أدخله في تطبيق Alexa (يعمل أيضاً في Apple Home و Google Home).', paired: 'تم الاقتران', notPaired: 'لم يُقترن بعد', starting: 'جارٍ التشغيل…',
    changed: 'تغيّرت الوصفات. شغّل اكتشاف الأجهزة في Alexa مرة أخرى.', done: 'تم',
    defCoffee: 'القهوة الافتراضية', defSub: 'ما يحضّره «Alexa, turn on coffee»', recent: 'آخر الأوامر', logLink: 'السجل',
    proTitle: 'نقطة برو', proSub: 'مركز تحكم صوتي متكامل. إعداد بضغطة، ويتحدّث تلقائياً.',
    pf: ['اسم صوتي لكل وصفة', 'اختر قهوتك الافتراضية', 'اختصارات Siri و NFC', 'خيارات الأمان وسجل النشاط', 'Apple Home و Google Home عند وصولهما'],
    price: 'ر.س · مرة واحدة · مدى الحياة', getPro: 'احصل على نقطة برو', locked: 'هذا الجزء في نقطة برو',
    hSpoken: 'الاسم المنطوق', hOn: 'عند التشغيل', hOff: 'عند الإيقاف', hState: 'الحالة', momentary: 'لحظي', same: 'نفسه',
    dev: {
      coffee: ['Coffee', '«Alexa, turn on coffee»', 'تحضير الوصفة المختارة', 'إيقاف التحضير'],
      pause: ['Coffee Pause', '«Alexa, turn on coffee pause»', 'إيقاف مؤقت للتحضير', 'متابعة'],
      water: ['Hot Water', '«Alexa, turn on hot water»', (s) => `صبّ ${s.water_ml} مل عند ${s.water_temp}°`, 'إيقاف'],
      grind: ['Grinder', '«Alexa, turn on grinder»', (s) => `بدء الطحن، يتوقف بعد ${s.grind_s} ث`, 'إيقاف'],
      scale: ['Scale', '«Alexa, turn on scale»', 'تصفير الميزان', null],
      wake: ['Coffee Machine', '«Alexa, turn on coffee machine»', 'إيقاظ المكنة', null],
    },
    chooseTitle: 'اختر ما يصل إلى Alexa', chooseSub: 'لا يُرسل إلى Alexa إلا ما تفعّله هنا. اختر أولاً، ثم شغّل الاكتشاف في تطبيق Alexa.',
    gFunctions: 'المكنة', gRecipes: 'الوصفات', brewIt: (n) => `تحضير ${n}`, nameFirst: 'أعطها اسماً منطوقاً أولاً', editNames: 'الأسماء والترتيب',
    chosen: (n) => `${n} مختارة`, sendHint: 'تم التغيير. في تطبيق Alexa: إضافة جهاز ← اكتشاف.',
    fresh: 'ابدأ من جديد', freshTitle: 'احذف كل شيء من Alexa وأعد الإعداد',
    fresh1: 'اضغط «إعادة ضبط» بالأسفل. تأخذ كل أجهزة نقطة هوية جديدة، فتتوقف القديمة في Alexa عن الاستجابة.',
    fresh2: 'في تطبيق Alexa افتح الأجهزة واحذف أجهزة نقطة القديمة. تظهر بعبارة «الجهاز لا يستجيب».',
    fresh3: 'اختر ما تريده من تبويب الأجهزة، ثم في تطبيق Alexa: إضافة جهاز ← اكتشاف.',
    freshBtn: 'إعادة ضبط الأجهزة', freshDone: 'تمت إعادة الضبط. الأجهزة القديمة لم تعد تستجيب. احذفها من تطبيق Alexa ثم شغّل الاكتشاف.', cancel: 'إلغاء',
    chk: 'فحص الاتصال', chkSub: 'مباشر. يوضّح إلى أين يصل Alexa.',
    chk1: 'تم الاقتران مع Alexa', chk1h: 'أضف نقطة في تطبيق Alexa برمز الإعداد.',
    chk2: 'فحص Alexa أحد الأجهزة', chk2h: 'افتح الأجهزة في تطبيق Alexa واسحب للتحديث.',
    chk3: 'أرسل Alexa أمراً', chk3h: 'اضغط جهازاً في تطبيق Alexa، أو قل «Alexa, turn on coffee machine».',
    notYet: 'ليس بعد', ago: (s) => (s < 60 ? `قبل ${s} ث` : s < 3600 ? `قبل ${Math.floor(s / 60)} د` : `قبل ${Math.floor(s / 3600)} س`),
    sending: 'ما يُعرض على Alexa:',
    recCmds: 'أوامر الوصفات', enabledOf: (a) => `${a} من 10 مفعّلة`, recLink: 'الوصفات',
    recTitle: 'الأوامر الصوتية للوصفات', of10: 'من 10', star: '★ = القهوة الافتراضية', typeName: 'اكتب اسماً بحروف إنجليزية',
    pArabic: 'الاسم العربي قد لا يُنطق', pEmoji: 'الرموز لا تُنطق', pEmpty: 'يحتاج اسماً منطوقاً', pDup: 'الاسم مستخدم',
    emptySlot: 'خانة فارغة · تُملأ من وصفاتك', noRec: 'لا توجد وصفات بعد', noRecSub: 'أضف وصفة لتظهر هنا كأمر صوتي يمكنك تسميته.', addRec: 'إضافة وصفة',
    up: 'تحريك للأعلى', down: 'تحريك للأسفل', makeDefault: 'اجعلها الافتراضية',
    scHint: 'الصق العنوان في اختصارات Apple أو Siri أو بطاقة NFC أو Home Assistant. يعمل على نفس الواي فاي فقط.', copy: 'نسخ', copied: 'تم النسخ',
    sc: { brew: 'تحضير', stop: 'إيقاف', pause: 'إيقاف مؤقت', tare: 'تصفير الميزان', wake: 'إيقاظ المكنة', 'hot-water': 'ماء ساخن', grind: 'طحن' },
    safety: 'خيارات الأمان', ask: 'اسألني على اللوحة قبل بدء تحضير صوتي', askSub: 'يعرض «هل الكوب في مكانه؟» ويحضّر بعد موافقتك.',
    grindS: 'إيقاف الطحن تلقائياً بعد', grindSub: 'يحمي المطحنة إن نسيت إيقافها.',
    wMl: 'كمية الماء الساخن', wMlSub: 'ما يصبّه «Hot Water».', wT: 'حرارة الماء الساخن', wTSub: 'بالدرجة المئوية.', s: 'ث', ml: 'مل',
    know: 'للعلم', knowText: 'الأوامر الصوتية لا تُؤكَّد بالصوت: بلا كوب في مكانه سيحضّر. ولا يبدأ تحضير أثناء تحضير آخر.',
    src: { alexa: 'Alexa', shortcut: 'اختصار' }, ok: 'تم', refused: 'رُفض', noLog: 'لا توجد أوامر بعد. تظهر هنا عندما يرسلها Alexa أو اختصار.',
    act: { brew: (r) => `تحضير ${r || ''}`.trim(), stop: () => 'إيقاف', pause: () => 'إيقاف مؤقت', resume: () => 'متابعة', water: () => 'ماء ساخن', water_stop: () => 'إيقاف الماء الساخن', grind: () => 'طحن', grind_stop: () => 'إيقاف الطحن', tare: () => 'تصفير الميزان', wake: () => 'إيقاظ المكنة' },
    why: { brew_running: 'تحضير جارٍ بالفعل', not_connected: 'المكنة غير متصلة', voice_off: 'التحكم الصوتي متوقف', device_off: 'الجهاز موقوف', cancelled: 'أُلغي من اللوحة', no_recipe: 'لا توجد وصفة' },
    today: 'اليوم', yest: 'أمس',
  },
};
const TABS = ['overview', 'devices', 'recipes', 'shortcuts', 'safety', 'log'];
const SHORTCUTS = ['brew', 'stop', 'pause', 'tare', 'wake', 'hot-water', 'grind'];

const MIC = ['..a..', '.aaa.', 'a.a.a', 'aaaaa', 'a.a.a', '.aaa.', '..a..', '.aaa.'];
export function VoiceMark({ size = 22 }) {
  const step = size / 8;
  return (
    <svg width={step * 5} height={size} viewBox={`0 0 ${step * 5} ${size}`} aria-hidden="true">
      {MIC.flatMap((row, y) => [...row].map((ch, x) => (ch === 'a' ? <circle key={`${x}-${y}`} cx={x * step + step / 2} cy={y * step + step / 2} r={step * 0.38} fill="currentColor" /> : null)))}
    </svg>
  );
}

function when(ts, T) {
  const d = new Date(ts * 1000);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  return { hm, today: diff === 0, label: diff === 0 ? T.today : diff === 1 ? T.yest : `${d.getDate()}/${d.getMonth() + 1}` };
}

async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const Switch = ({ on, onChange, disabled, label }) => (
  <button className={`switch vc-switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />
);
const Pro = () => <span className="pro-badge sm">PRO</span>;

function Stepper({ value, unit, min, max, step, onChange }) {
  return (
    <div className="vc-stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="−">−</button>
      <span><b dir="ltr">{value}</b>{unit && <i>{unit}</i>}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="+">+</button>
    </div>
  );
}

export default function VoicePage({ lang, machine, tick, onBack, onGetPro, onConnect, onWake, onStop, onAddRecipe, showToast }) {
  const T = TX[lang] || TX.en;
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('overview');
  const [copied, setCopied] = useState('');
  const [helperHelp, setHelperHelp] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [pairApp, setPairApp] = useState(null);   // 'apple' | 'google'
  const [names, setNames] = useState({});            // voice names being typed, before they're saved
  const saveTimer = useRef(null);

  const load = useCallback(() => fetch('/api/voice').then((r) => r.json()).then((x) => { if (x && x.devices) setD(x); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load, tick]);
  useEffect(() => { const iv = setInterval(load, 5000); return () => clearInterval(iv); }, [load]);   // keeps the connection check live
  const patch = useCallback(async (body) => {
    try {
      const r = await fetch('/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const x = await r.json();
      if (x && x.devices) setD(x);
      return x;
    } catch { return null; }
  }, []);

  if (!d) return <div className="vc-page" />;
  const pro = d.pro;
  const S = d.safety;
  const last = d.log[0];
  const lastW = last ? when(last.ts, T) : null;
  const brewing = machine.brew_active;
  const mState = machine.link !== 'connected' ? 'off' : brewing ? 'brewing' : machine.sleeping ? 'asleep' : 'ok';
  const elapsed = brewing && machine.brew_elapsed ? `${String(Math.floor(machine.brew_elapsed / 60)).padStart(2, '0')}:${String(Math.floor(machine.brew_elapsed % 60)).padStart(2, '0')}` : '';
  const enabledRecipes = d.recipes.filter((r) => r.on).length;

  const saveRecipes = (list) => patch({ recipes: list.map(({ name, voice, on }) => ({ name, voice, on })) });
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= d.recipes.length) return; const l = d.recipes.slice(); [l[i], l[j]] = [l[j], l[i]]; saveRecipes(l); };
  const typeName = (name, voice) => {
    setNames((n) => ({ ...n, [name]: voice }));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveRecipes(d.recipes.map((r) => (r.name === name ? { ...r, voice } : { ...r, voice: names[r.name] ?? r.voice })))
        .then(() => setNames({}));
    }, 700);
  };

  const picked = (pro ? d.devices.filter((x) => x.enabled).length : d.devices.length) + d.recipes.filter((r) => r.on).length;
  const banner = !d.enabled ? { cls: 'warn', text: T.bOff, btn: tab === 'devices' ? null : T.turnOn, act: () => setTab('devices') }
    : !d.helper ? { cls: 'err', text: helperHelp ? T.helperHow : T.bHelper, btn: helperHelp ? null : T.howInstall, act: () => setHelperHelp(true) }
    : mState === 'off' ? { cls: 'err', text: T.bDisc, btn: T.connect, act: onConnect }
    : mState === 'asleep' ? { cls: 'warn', text: T.bAsleep, btn: T.wake, act: onWake }
    : mState === 'brewing' ? { cls: 'accent', text: T.bBrew(machine.recipe_name), btn: T.stop, act: onStop }
    : null;

  const chip = mState === 'ok' ? ['ok', T.mConnected] : mState === 'off' ? ['err', T.mOff] : mState === 'asleep' ? ['warn', T.mAsleep] : ['accent', `${T.mBrewing}${elapsed ? ` · ${elapsed}` : ''}`];

  const logRow = (e, i, compact) => {
    const w = when(e.ts, T);
    return (
      <div key={`${e.ts}-${i}`} className={`vc-log-row${compact ? ' compact' : ''}`}>
        <span className={`vc-time${w.today ? ' today' : ''}`} dir="ltr">{w.today ? w.hm : `${w.label} ${w.hm}`}</span>
        <span className="vc-src">{T.src[e.source] || e.source}</span>
        <b className="vc-act" dir="auto">{(T.act[e.action] || (() => e.action))(e.recipe)}</b>
        <span className={`vc-chip ${e.ok ? 'ok' : 'err'}`}><i />{e.ok ? T.ok : T.refused}</span>
        {!compact && !e.ok && <span className="vc-why">{T.why[e.reason] || e.reason}</span>}
      </div>
    );
  };

  const lockCard = (
    <div className="vc-lock-card">
      <div className="vc-lock-top"><LockMark size={22} /><Pro /></div>
      <b>{T.locked}</b>
      <div className="vc-price"><span dir="ltr">{PRO_PRICE_SAR}</span> {T.price}</div>
      <button className="nb nb-primary" onClick={onGetPro}>{T.getPro}</button>
    </div>
  );

  let body;
  if (tab === 'overview') {
    body = (
      <div className="vc-overview">
        <div className="vc-main">
          <div className="vc-platforms">
            {[['alexa', 'A', d.enabled && d.helper ? 'ok' : 'idle', d.enabled && d.helper ? T.connected : T.notSetUp, T.alexaHow, false],
              ['apple', 'H', d.matter?.running ? 'ok' : 'idle', d.matter?.running ? T.ready : T.notSetUp, T.appleHow, 'pair'],
              ['google', 'G', d.matter?.running ? 'ok' : 'idle', d.matter?.running ? T.ready : T.notSetUp, T.googleHow, 'pair']].map(([k, letter, st, stText, how, soon]) => (
              <div key={k} className={`vc-card vc-platform${soon ? ' soon' : ''}`}>
                <div className="vc-plat-head">
                  <span className="vc-logo">{letter}</span>
                  <div><b>{T[k]}</b><span className={`vc-chip ${st}`}><i />{stText}</span></div>
                  {soon && !pro && <span className="vc-plat-lock"><LockMark size={14} /><Pro /></span>}
                </div>
                <p>{how}</p>
                {soon
                  ? <button className="nb nb-secondary" disabled={!d.matter?.running} onClick={() => (pro ? setPairApp(k) : onGetPro())}>{T.setUp}</button>
                  : <>
                    <button className="nb nb-secondary" disabled={!d.enabled || !d.helper} onClick={() => patch({ rediscover: true }).then(() => showToast?.(T.rediscovered, 'info'))}>{T.rediscover}</button>
                    <button className="vc-link start" disabled={!d.helper} onClick={() => setFresh(true)}>{T.fresh}</button>
                  </>}
              </div>
            ))}
          </div>
          {d.enabled && d.helper && (
            <div className="vc-card vc-check">
              <div className="vc-card-head"><b className="vc-card-title">{T.chk}</b><span className="vc-muted">{T.chkSub}</span></div>
              {[['read', T.chk1, T.chk1h], ['command', T.chk3, T.chk3h]].map(([k, label, hint]) => {
                const ts = k === 'read' ? (d.matter?.paired ? (d.alexa?.read || Date.now() / 1000) : null) : d.alexa?.[k];
                const secs = ts ? Math.max(0, Math.round(Date.now() / 1000 - ts)) : null;
                return (
                  <div key={k} className={`vc-check-row${ts ? ' ok' : ''}`}>
                    <i />
                    <div><b>{label}{k === 'command' && ts && d.alexa.command_name ? ` · ${d.alexa.command_name}` : ''}</b>{!ts && <span>{hint}</span>}</div>
                    <span className={`vc-chip ${ts ? 'ok' : 'idle'}`}>{ts ? T.ago(secs) : T.notYet}</span>
                  </div>
                );
              })}
              <div className="vc-muted vc-offered">{T.sending} <span dir="ltr">{(d.names || []).join(' · ') || '—'}</span></div>
            </div>
          )}
          <div className="vc-card vc-steps">
            <b className="vc-card-title">{T.steps}</b>
            <ol>{[T.s1, T.s2, T.s3].map((s, i) => <li key={i}><span dir="ltr">{i + 1}</span>{s}</li>)}</ol>
            {d.enabled && d.helper && (
              <div className="vc-pair">
                <div><b>{T.pairTitle}</b><span>{T.pairSub}</span></div>
                <code dir="ltr">{d.matter?.code ? d.matter.code.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1-$2-$3') : T.starting}</code>
                <span className={`vc-chip ${d.matter?.paired ? 'ok' : 'idle'}`}><i />{d.matter?.paired ? T.paired : T.notPaired}</span>
                {!d.matter?.paired && <SetupQR text={d.matter?.qr} />}
              </div>
            )}
            {d.needs_discover && d.enabled && (
              <div className="vc-banner warn inline"><span>{T.changed}</span><button className="nb nb-secondary nb-sm" onClick={() => patch({ discovered: true })}>{T.done}</button></div>
            )}
          </div>
          {pro && d.log.length > 0 && (
            <div className="vc-card vc-recent">
              <div className="vc-card-head"><b className="vc-card-title">{T.recent}</b><button className="vc-link" onClick={() => setTab('log')}>{T.logLink} →</button></div>
              {d.log.slice(0, 3).map((e, i) => logRow(e, i, true))}
            </div>
          )}
        </div>
        <div className="vc-side">
          {pro ? (
            <div className="vc-card">
              <b className="vc-card-title">{T.defCoffee}</b>
              <span className="vc-muted">{T.defSub}</span>
              <div className="vc-radio">
                {d.all_recipes.slice(0, 12).map((n) => (
                  <button key={n} className={d.default === n ? 'on' : ''} onClick={() => patch({ default: n })} aria-pressed={d.default === n}><i /><span dir="auto">{n}</span></button>
                ))}
              </div>
            </div>
          ) : (
            <div className="vc-card vc-upsell">
              <div className="vc-card-head start"><Pro /><b className="vc-card-title">{T.proTitle}</b></div>
              <p>{T.proSub}</p>
              <ul>{T.pf.map((f) => <li key={f}><i />{f}</li>)}</ul>
              <div className="vc-price lg"><span dir="ltr">{PRO_PRICE_SAR}</span> {T.price}</div>
              <button className="nb nb-primary" onClick={onGetPro}>{T.getPro}</button>
            </div>
          )}
        </div>
      </div>
    );
  } else if (tab === 'devices') {
    const toggleRecipe = (name, v) => saveRecipes(d.recipes.map((x) => (x.name === name ? { ...x, on: v } : x)));
    body = (
      <div className="vc-table">
        <div className="vc-choose">
          <div><b>{T.chooseTitle}</b><span>{T.chooseSub}</span></div>
          <span className="vc-chip accent">{T.chosen(picked)}</span>
        </div>
        <div className={`vc-send${d.enabled ? ' live' : ''}`}>
          <span className={`vc-chip ${d.enabled ? 'ok' : 'idle'}`}><i />{d.enabled ? T.offOn : T.offOff}</span>
          {d.enabled
            ? <button className="nb nb-secondary nb-sm" onClick={() => patch({ enabled: false })}>{T.stopSend}</button>
            : <button className="nb nb-primary" disabled={picked === 0} onClick={() => patch({ enabled: true }).then(() => showToast?.(T.sentHint, 'info'))}>{picked === 0 ? T.sendNone : T.send(picked)}</button>}
        </div>
        {d.needs_discover && d.enabled && (
          <div className="vc-banner warn"><span>{T.sendHint}</span><button className="nb nb-secondary nb-sm" onClick={() => patch({ discovered: true })}>{T.done}</button></div>
        )}
        <div className="vc-group">{T.gFunctions}</div>
        <div className="vc-thead"><span>{T.hSpoken}</span><span>{T.hOn}</span><span>{T.hOff}</span><span>{T.hState}</span><span /></div>
        {d.devices.map((dv) => {
          const [name, phrase, on, off] = T.dev[dv.key];
          return (
            <div key={dv.key} className={`vc-row${dv.enabled ? '' : ' dim'}`}>
              <div className="vc-cell name"><b dir="ltr">{name}</b><span dir="ltr">{phrase}</span></div>
              <div className="vc-cell">{typeof on === 'function' ? on(S) : on}</div>
              <div className="vc-cell muted">{off || T.same}</div>
              <div className="vc-cell"><span className={`vc-chip ${dv.state === 'on' ? 'accent' : 'idle'}`}>{dv.state !== 'momentary' && <i />}{dv.state === 'on' ? T.on : dv.state === 'off' ? T.off : T.momentary}</span></div>
              <Switch on={dv.enabled} label={name} onChange={(v) => patch({ device: { key: dv.key, enabled: v } })} />
            </div>
          );
        })}
        <div className="vc-group">{T.gRecipes} <span>· {T.enabledOf(enabledRecipes)}</span><button className="vc-link" onClick={() => setTab('recipes')}>{T.editNames} →</button></div>
        {d.recipes.map((r) => (
          <div key={r.name} className={`vc-row${r.on ? '' : ' dim'}`}>
            <div className="vc-cell name"><b dir="ltr">{r.voice || '—'}</b><span dir="ltr">{r.voice ? `“Alexa, turn on ${r.voice}”` : ''}</span></div>
            <div className="vc-cell" dir="auto">{T.brewIt(r.name)}</div>
            <div className="vc-cell muted">{r.problem ? T.nameFirst : T.dev.coffee[3]}</div>
            <div className="vc-cell"><span className="vc-chip idle"><i />{T.off}</span></div>
            <Switch on={r.on} disabled={Boolean(r.problem)} label={r.name} onChange={(v) => toggleRecipe(r.name, v)} />
          </div>
        ))}
      </div>
    );
  } else if (tab === 'recipes') {
    body = d.recipes.length === 0 ? (
      <div className="vc-card vc-empty">
        <VoiceMark size={36} />
        <b>{T.noRec}</b><p>{T.noRecSub}</p>
        <button className="nb nb-primary" onClick={onAddRecipe}>{T.addRec}</button>
      </div>
    ) : (
      <div className="vc-recipes">
        <div className="vc-rec-head"><b>{T.recTitle}</b><span className="vc-num" dir="ltr">{enabledRecipes}</span><span className="vc-muted">{T.of10}</span><span className="vc-chip idle end">{T.star}</span></div>
        {d.recipes.map((r, i) => {
          const val = names[r.name] ?? r.voice;
          const prob = { arabic: T.pArabic, emoji: T.pEmoji, empty: T.pEmpty, duplicate: T.pDup }[r.problem];
          return (
            <div key={r.name} className={`vc-row rec${r.on ? '' : ' dim'}`}>
              <div className="vc-move">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={T.up}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === d.recipes.length - 1} aria-label={T.down}>▼</button>
              </div>
              <button className={`vc-star${d.default === r.name ? ' on' : ''}`} onClick={() => patch({ default: r.name })} aria-label={T.makeDefault} aria-pressed={d.default === r.name}>★</button>
              <b className="vc-rec-name" dir="auto">{r.name}</b>
              <div className="vc-rec-field">
                <input className={r.problem ? 'bad' : ''} dir="ltr" value={val} placeholder={T.typeName} maxLength={40} onChange={(e) => typeName(r.name, e.target.value)} aria-label={T.hSpoken} />
                {prob && <span className="vc-chip warn"><i />{prob}</span>}
              </div>
              <Switch on={r.on} disabled={Boolean(r.problem)} label={r.name} onChange={(v) => saveRecipes(d.recipes.map((x) => (x.name === r.name ? { ...x, on: v } : x)))} />
            </div>
          );
        })}
        {d.recipes.length < 10 && <div className="vc-row empty">{T.emptySlot}</div>}
      </div>
    );
  } else if (tab === 'shortcuts') {
    const base = d.bases[0];
    body = (
      <>
        <div className="vc-card vc-hint"><span className="vc-dots3" /><span>{T.scHint}</span></div>
        <div className="vc-shortcuts">
          {SHORTCUTS.map((k) => {
            const url = `${base}/voice/${k}`;
            return (
              <div key={k} className="vc-card vc-sc">
                <div className="vc-card-head"><b>{T.sc[k]}</b>
                  <button className={`nb nb-secondary nb-sm${copied === k ? ' vc-copied' : ''}`} onClick={async () => { if (await copyText(url)) { setCopied(k); setTimeout(() => setCopied((c) => (c === k ? '' : c)), 1800); } }}>{copied === k ? T.copied : T.copy}</button>
                </div>
                <code dir="ltr">{url}</code>
              </div>
            );
          })}
        </div>
      </>
    );
  } else if (tab === 'safety') {
    const setS = (k, v) => patch({ safety: { [k]: v } });
    body = (
      <div className="vc-overview">
        <div className="vc-main">
          <div className="vc-card vc-safety">
            <b className="vc-card-title">{T.safety}</b>
            <div className="vc-opt"><div><b>{T.ask}</b><span>{T.askSub}</span></div><Switch on={S.ask} label={T.ask} onChange={(v) => setS('ask', v)} /></div>
            <div className="vc-opt"><div><b>{T.grindS}</b><span>{T.grindSub}</span></div><Stepper value={S.grind_s} unit={T.s} min={5} max={60} step={5} onChange={(v) => setS('grind_s', v)} /></div>
            <div className="vc-opt"><div><b>{T.wMl}</b><span>{T.wMlSub}</span></div><Stepper value={S.water_ml} unit={T.ml} min={30} max={500} step={10} onChange={(v) => setS('water_ml', v)} /></div>
            <div className="vc-opt"><div><b>{T.wT}</b><span>{T.wTSub}</span></div><Stepper value={S.water_temp} unit="°" min={40} max={98} step={1} onChange={(v) => setS('water_temp', v)} /></div>
          </div>
        </div>
        <div className="vc-side"><div className="vc-card vc-hint col"><span className="vc-dots3" /><div><b>{T.know}</b><p>{T.knowText}</p></div></div></div>
      </div>
    );
  } else {
    body = d.log.length === 0 || !pro
      ? <div className="vc-card vc-empty"><VoiceMark size={36} /><p>{T.noLog}</p></div>
      : <div className="vc-log">{d.log.map((e, i) => logRow(e, i, false))}</div>;
  }

  const lockedTab = !pro && tab !== 'overview';

  return (
    <div className="vc-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="vc-head">
        <div className="vc-title">
          <LogoMark size={30} />
          <div><h1>{T.title} <Pro /></h1><span>{T.sub}</span></div>
        </div>
        <div className="vc-tabs" role="tablist">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{T.tabs[k]}{!pro && k !== 'overview' && <Pro />}</button>
          ))}
        </div>
        <button className="nb nb-secondary vc-back" onClick={onBack}><span aria-hidden="true">{lang === 'ar' ? '→' : '←'}</span><span className="vc-back-text">{T.back}</span></button>
      </div>

      <div className={`vc-card vc-status${d.enabled ? '' : ' dim'}`}>
        <div className="vc-st-main">
          <span className="vc-st-icon"><VoiceMark size={30} /></span>
          <div><span>{T.vc}</span><b>{d.enabled ? T.on : T.off}</b></div>
          <Switch on={d.enabled} label={T.vc} onChange={(v) => (v && picked === 0 ? setTab('devices') : patch({ enabled: v }))} />
        </div>
        <div className="vc-st-cell"><span>{T.seen}</span><b className="vc-num" dir="ltr">{d.count}</b></div>
        <div className="vc-st-cell"><span>{T.last}</span><b dir="auto">{last ? (last.recipe || (T.act[last.action] || (() => last.action))()) : T.none}</b>{lastW && <span dir="ltr">{lastW.label} {lastW.hm}</span>}</div>
        <span className={`vc-chip ${chip[0]} vc-st-chip`}><i />{chip[1]}</span>
      </div>
      {banner && (
        <div className={`vc-banner ${banner.cls}`}><span>{banner.text}</span>{banner.btn && <button className="nb nb-secondary nb-sm" onClick={banner.act}>{banner.btn}</button>}</div>
      )}

      {pairApp && (
        <div className="modal-overlay" onClick={() => setPairApp(null)}>
          <div className="modal sheet-form vc-fresh" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{pairApp === 'apple' ? T.pairApple : T.pairGoogle}</div>
            <div className="vc-pair">
              <div><b>{T.pairTitle}</b><span>{(d.matter?.apps || []).length ? T.pairedApps(d.matter.apps.length) : T.pairFirst}</span></div>
              <code dir="ltr">{d.matter?.code ? d.matter.code.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1-$2-$3') : T.starting}</code>
              <span className={`vc-chip ${d.matter?.window || !d.matter?.paired ? 'ok' : 'idle'}`}><i />{d.matter?.window || !d.matter?.paired ? T.pairOpen : T.pairClosed}</span>
              <SetupQR text={d.matter?.qr} />
            </div>
            <ol>{(pairApp === 'apple' ? [T.ap0, T.ap1, T.ap2, T.ap3] : [T.gp0, T.gp1, T.gp2, T.gp3]).map((x, i) => <li key={i}><span dir="ltr">{i + 1}</span>{x}</li>)}</ol>
            <div className="btn-row">
              <button className="nb nb-secondary" onClick={() => setPairApp(null)}>{T.close}</button>
              <button className="nb nb-primary" disabled={d.matter?.window || !d.matter?.paired} onClick={() => patch({ pair_another: true })}>{T.openPair}</button>
            </div>
          </div>
        </div>
      )}

      {fresh && (
        <div className="modal-overlay" onClick={() => setFresh(false)}>
          <div className="modal sheet-form vc-fresh" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{T.freshTitle}</div>
            <ol>{[T.fresh1, T.fresh2, T.fresh3].map((x, i) => <li key={i}><span dir="ltr">{i + 1}</span>{x}</li>)}</ol>
            <div className="btn-row">
              <button className="nb nb-secondary" onClick={() => setFresh(false)}>{T.cancel}</button>
              <button className="nb nb-primary" onClick={() => patch({ fresh: true }).then(() => { setFresh(false); showToast?.(T.freshDone, 'info'); setTab('devices'); })}>{T.freshBtn}</button>
            </div>
          </div>
        </div>
      )}

      <div className={`vc-body${lockedTab ? ' locked' : ''}`}>
        <div className="vc-body-in" aria-hidden={lockedTab} inert={lockedTab ? '' : undefined}>{body}</div>
        {lockedTab && lockCard}
      </div>
    </div>
  );
}
