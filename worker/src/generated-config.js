// 自動產生檔，請勿手改。來源：config/watch_terms.yml 與 config/entities.yml；重跑 `npm run gen-config`。
export const WATCH_TERMS = [
  {
    "id": "tsmc",
    "display": "台積電",
    "anyOf": [
      "台積電",
      "台積",
      "TSMC",
      "護國神山"
    ],
    "exclude": []
  },
  {
    "id": "legislature",
    "display": "立法院",
    "anyOf": [
      "立法院",
      "立院",
      "朝野協商"
    ],
    "exclude": []
  },
  {
    "id": "typhoon",
    "display": "颱風",
    "anyOf": [
      "颱風",
      "熱帶低壓",
      "颱風假",
      "停班停課"
    ],
    "exclude": []
  },
  {
    "id": "power_price",
    "display": "電價",
    "anyOf": [
      "電價",
      "電費",
      "台電"
    ],
    "exclude": []
  },
  {
    "id": "exchange_rate",
    "display": "台幣匯率",
    "anyOf": [
      "台幣",
      "新台幣",
      "匯率"
    ],
    "exclude": []
  },
  {
    "id": "housing",
    "display": "房價",
    "anyOf": [
      "房價",
      "房市",
      "打房"
    ],
    "exclude": []
  }
];

export const AUTO_TERMS = {
  "maxTerms": 10,
  "minDocs": 5,
  "minSources": 3,
  "minLength": 2,
  "stopwords": [
    "快訊",
    "影",
    "圖",
    "獨家",
    "直播",
    "專訪",
    "報導",
    "新聞",
    "今日",
    "昨日",
    "記者",
    "表示",
    "指出",
    "一名",
    "民眾",
    "台灣",
    "相關",
    "最新",
    "曝光",
    "關鍵",
    "國際",
    "速報",
    "快報",
    "影音",
    "直擊",
    "盤點",
    "回顧",
    "完整",
    "一次看",
    "懶人包",
    "網友",
    "這些",
    "竟然",
    "台北",
    "新北",
    "台中",
    "台南",
    "高雄",
    "桃園",
    "新竹",
    "基隆",
    "宜蘭",
    "花蓮",
    "台東",
    "屏東",
    "嘉義",
    "彰化",
    "南投",
    "雲林",
    "苗栗",
    "政治",
    "社會",
    "生活",
    "財經",
    "體育",
    "娛樂",
    "天氣",
    "地方",
    "健康",
    "調查",
    "宣布",
    "證實",
    "回應",
    "分析",
    "沒有",
    "因為",
    "可能",
    "日報",
    "時報",
    "週刊",
    "電子報",
    "雜誌",
    "目標價",
    "評等",
    "除息",
    "除權",
    "開盤",
    "收盤",
    "早盤",
    "盤中",
    "盤後",
    "法人",
    "外資",
    "個股",
    "選股",
    "今彩",
    "威力彩",
    "大樂透",
    "雙贏彩",
    "樂合彩",
    "三星彩",
    "四星彩",
    "開獎",
    "中獎",
    "頭獎",
    "獎號",
    "部落",
    "網紅",
    "經濟",
    "政院",
    "半年",
    "上半",
    "下半",
    "今年",
    "明年",
    "去年"
  ]
};

export const ORG_LEXICON = [
  {
    "name": "總統府",
    "aliases": []
  },
  {
    "name": "行政院",
    "aliases": []
  },
  {
    "name": "立法院",
    "aliases": [
      "立院"
    ]
  },
  {
    "name": "司法院",
    "aliases": []
  },
  {
    "name": "監察院",
    "aliases": []
  },
  {
    "name": "考試院",
    "aliases": []
  },
  {
    "name": "國防部",
    "aliases": []
  },
  {
    "name": "外交部",
    "aliases": []
  },
  {
    "name": "內政部",
    "aliases": []
  },
  {
    "name": "經濟部",
    "aliases": []
  },
  {
    "name": "財政部",
    "aliases": []
  },
  {
    "name": "交通部",
    "aliases": []
  },
  {
    "name": "教育部",
    "aliases": []
  },
  {
    "name": "勞動部",
    "aliases": []
  },
  {
    "name": "法務部",
    "aliases": []
  },
  {
    "name": "環境部",
    "aliases": []
  },
  {
    "name": "文化部",
    "aliases": []
  },
  {
    "name": "數位發展部",
    "aliases": [
      "數發部"
    ]
  },
  {
    "name": "衛福部",
    "aliases": [
      "衛生福利部"
    ]
  },
  {
    "name": "農業部",
    "aliases": []
  },
  {
    "name": "陸委會",
    "aliases": [
      "大陸委員會"
    ]
  },
  {
    "name": "國發會",
    "aliases": [
      "國家發展委員會"
    ]
  },
  {
    "name": "金管會",
    "aliases": [
      "金融監督管理委員會"
    ]
  },
  {
    "name": "公平會",
    "aliases": [
      "公平交易委員會"
    ]
  },
  {
    "name": "NCC",
    "aliases": [
      "國家通訊傳播委員會"
    ]
  },
  {
    "name": "中選會",
    "aliases": [
      "中央選舉委員會"
    ]
  },
  {
    "name": "中央銀行",
    "aliases": [
      "央行"
    ]
  },
  {
    "name": "中央氣象署",
    "aliases": [
      "氣象署"
    ]
  },
  {
    "name": "疾管署",
    "aliases": [
      "疾病管制署"
    ]
  },
  {
    "name": "健保署",
    "aliases": [
      "中央健康保險署"
    ]
  },
  {
    "name": "食藥署",
    "aliases": [
      "食品藥物管理署"
    ]
  },
  {
    "name": "國稅局",
    "aliases": []
  },
  {
    "name": "警政署",
    "aliases": []
  },
  {
    "name": "消防署",
    "aliases": []
  },
  {
    "name": "海巡署",
    "aliases": []
  },
  {
    "name": "移民署",
    "aliases": []
  },
  {
    "name": "台北市政府",
    "aliases": [
      "北市府"
    ]
  },
  {
    "name": "新北市政府",
    "aliases": [
      "新北市府"
    ]
  },
  {
    "name": "台中市政府",
    "aliases": [
      "中市府"
    ]
  },
  {
    "name": "台南市政府",
    "aliases": [
      "南市府"
    ]
  },
  {
    "name": "高雄市政府",
    "aliases": [
      "高市府"
    ]
  },
  {
    "name": "桃園市政府",
    "aliases": [
      "桃市府"
    ]
  },
  {
    "name": "民進黨",
    "aliases": [
      "民主進步黨"
    ]
  },
  {
    "name": "國民黨",
    "aliases": [
      "中國國民黨"
    ]
  },
  {
    "name": "民眾黨",
    "aliases": [
      "台灣民眾黨"
    ]
  },
  {
    "name": "時代力量",
    "aliases": []
  },
  {
    "name": "台電",
    "aliases": [
      "台灣電力公司"
    ]
  },
  {
    "name": "中油",
    "aliases": [
      "台灣中油"
    ]
  },
  {
    "name": "台水",
    "aliases": [
      "台灣自來水公司"
    ]
  },
  {
    "name": "台鐵",
    "aliases": [
      "台灣鐵路"
    ]
  },
  {
    "name": "高鐵",
    "aliases": [
      "台灣高鐵"
    ]
  },
  {
    "name": "桃園機場",
    "aliases": [
      "桃機"
    ]
  },
  {
    "name": "華航",
    "aliases": [
      "中華航空"
    ]
  },
  {
    "name": "長榮航空",
    "aliases": []
  },
  {
    "name": "星宇航空",
    "aliases": []
  },
  {
    "name": "台積電",
    "aliases": [
      "TSMC",
      "台灣積體電路"
    ]
  },
  {
    "name": "鴻海",
    "aliases": [
      "Foxconn",
      "富士康"
    ]
  },
  {
    "name": "聯發科",
    "aliases": [
      "MediaTek"
    ]
  },
  {
    "name": "聯電",
    "aliases": [
      "UMC"
    ]
  },
  {
    "name": "日月光",
    "aliases": []
  },
  {
    "name": "廣達",
    "aliases": []
  },
  {
    "name": "緯創",
    "aliases": []
  },
  {
    "name": "華碩",
    "aliases": [
      "ASUS"
    ]
  },
  {
    "name": "宏碁",
    "aliases": [
      "acer"
    ]
  },
  {
    "name": "長榮海運",
    "aliases": []
  },
  {
    "name": "陽明海運",
    "aliases": []
  },
  {
    "name": "萬海",
    "aliases": []
  },
  {
    "name": "中華電信",
    "aliases": []
  },
  {
    "name": "台灣大哥大",
    "aliases": [
      "台灣大"
    ]
  },
  {
    "name": "遠傳",
    "aliases": []
  },
  {
    "name": "國泰金",
    "aliases": [
      "國泰金控"
    ]
  },
  {
    "name": "富邦金",
    "aliases": [
      "富邦金控"
    ]
  },
  {
    "name": "中信金",
    "aliases": [
      "中信金控",
      "中國信託"
    ]
  },
  {
    "name": "玉山金",
    "aliases": [
      "玉山銀行"
    ]
  },
  {
    "name": "兆豐金",
    "aliases": [
      "兆豐銀行"
    ]
  },
  {
    "name": "輝達",
    "aliases": [
      "NVIDIA"
    ]
  },
  {
    "name": "OpenAI",
    "aliases": []
  },
  {
    "name": "Google",
    "aliases": [
      "谷歌"
    ]
  },
  {
    "name": "蘋果",
    "aliases": [
      "Apple"
    ]
  },
  {
    "name": "微軟",
    "aliases": [
      "Microsoft"
    ]
  },
  {
    "name": "Meta",
    "aliases": []
  },
  {
    "name": "亞馬遜",
    "aliases": [
      "Amazon"
    ]
  },
  {
    "name": "特斯拉",
    "aliases": [
      "Tesla"
    ]
  },
  {
    "name": "三星",
    "aliases": [
      "Samsung"
    ]
  },
  {
    "name": "英特爾",
    "aliases": [
      "Intel"
    ]
  }
];
