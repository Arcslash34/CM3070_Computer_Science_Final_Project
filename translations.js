// translations.js
const translations = {
  en: {
    detecting: 'Detecting location...',
    yourLocation: 'Your location:',
    forecast: '2-Hour Forecast',
    alertNear: 'Alert near your location:',
    noAlerts: 'No alerts in your area. Here’s how to stay prepared:',
    emergencyInstructions: 'Emergency Instructions:',
    quiz: 'Quick Quiz:',
    submitAnswer: 'Submit Answer',
    correct: 'Correct! You earned a badge!',
    wrong: 'Oops! That is not the right answer.',
    language: 'Language',
    alertMessage: 'Flash Flood Warning!',
    weatherPhrases: {
      'Partly Cloudy (Day)': 'Partly Cloudy (Day)',
      'Fair and Warm': 'Fair and Warm',
      'Cloudy': 'Cloudy',
      'Light Rain': 'Light Rain',
      'Moderate Rain': 'Moderate Rain',
      'Heavy Rain': 'Heavy Rain',
      'No Rain': 'No Rain',
    },
    placeNames: {
      'Taman Jurong': 'Taman Jurong',
      'Jurong West': 'Jurong West',
    },
    instructions: [
      'Avoid low-lying areas',
      'Move to higher ground',
      'Check local advisories',
    ],
    quizList: [
      {
        question: 'What should you do first during a flash flood?',
        options: ['Evacuate immediately', 'Take a selfie', 'Call your neighbor'],
        correctIndex: 0,
      },
      {
        question: 'Which area should be avoided?',
        options: ['Low-lying areas', 'High ground', 'Evacuation center'],
        correctIndex: 0,
      },
      {
        question: 'Who should you listen to during a disaster?',
        options: ['Social media', 'Local authorities', 'Random strangers'],
        correctIndex: 1,
      },
    ],
    presetQuestions: [
      'What should I do during a flood?',
      'What to pack in emergency kit?',
      'How to evacuate safely?',
    ],
    askQuestion: 'Type your question here...',
    typing: 'Bot is typing...',
  },
  zh: {
    detecting: '正在检测位置...',
    yourLocation: '你的位置：',
    forecast: '两小时天气预报',
    alertNear: '您附近的警报：',
    noAlerts: '您所在地区没有警报。以下是准备方法：',
    emergencyInstructions: '紧急指示：',
    quiz: '快速问答：',
    submitAnswer: '提交答案',
    correct: '正确！您获得了徽章！',
    wrong: '哎呀！答案不对。',
    language: '语言',
    alertMessage: '洪水警报！',
    instructions: ['避免低洼地区', '转移到高地', '关注当地通告'],
    weatherPhrases: {
      'Partly Cloudy (Day)': '白天局部多云',
      'Fair and Warm': '晴朗炎热',
      'Cloudy': '多云',
      'Light Rain': '小雨',
      'Moderate Rain': '中雨',
      'Heavy Rain': '大雨',
      'No Rain': '无雨',
    },
    placeNames: {
      'Taman Jurong': '达曼裕廊',
      'Jurong West': '裕廊西',
    },
    quizList: [
      {
        question: '发生洪水时你应该首先做什么？',
        options: ['立即撤离', '自拍一张', '打电话给邻居'],
        correctIndex: 0,
      },
      {
        question: '应该避免哪个区域？',
        options: ['低洼地区', '高地', '疏散中心'],
        correctIndex: 0,
      },
      {
        question: '灾难发生时应该听谁的？',
        options: ['社交媒体', '地方当局', '陌生人'],
        correctIndex: 1,
      },
    ],
    presetQuestions: [
      '洪水期间我该怎么办？',
      '应急包应装什么？',
      '如何安全撤离？',
    ],
    askQuestion: '请在此输入您的问题...',
    typing: '机器人正在输入...',
  },
};

export default translations;
