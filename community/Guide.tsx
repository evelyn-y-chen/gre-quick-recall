import {useState} from 'react';

type Topic = {zh: string; en: string; cn: string[]; english: string[]};
type GuideGroup = {zh: string; en: string; topics: Topic[]};

const groups: GuideGroup[] = [
  {
    zh: '开始使用',
    en: 'Get started',
    topics: [
      {
        zh: '选择账号模式或便笺模式',
        en: 'Choose an account or learning-note mode',
        cn: [
          '账号模式：选择「登录 / 注册」，可创建用户名与密码，或使用已开放的第三方登录。无需填写邮箱。已有 GitHub 用户可登录后选择「设置用户名登录」，为原账号添加用户名与密码，保留已有进度。Google 是否可用以登录窗口为准。',
          '登录后，已保存的笔记、红黄绿、生词本、测试进度、学习计划、来源偏好和配色可同步到账号。在其他设备登录同一账号，即可读取。',
          '修改会自动写入这台设备，账号上传另行进行。点「立即同步」后按钮显示同步中，并核对账号记录；成功会显示确认时间和版本。失败或超时会明确提示，可重试或先导出便笺。没有新增修改时，也会确认账号连接，不再没有反馈。',
          '已设置用户名且记得密码时，可在顶部「更多」→「账号登录方式」验证当前密码、重新生成恢复码，旧码随即失效。忘记密码时先退出，再从登录页选择「使用恢复码找回账号」。',
          '便笺模式：无需注册，直接开始学习。记录保存在当前浏览器。选择「带走便笺」导出文件，下次或换设备时选择「读取便笺」恢复。账号模式也支持便笺备份。',
          '注册或设置用户名时，请保存恢复码。忘记密码可用恢复码设置新密码；恢复后请保存新码。密码和恢复码都遗失且没有其他已绑定登录方式时，将无法找回账号。请另行导出便笺留底。游客与各账号使用独立的学习空间。新账号可主动导入游客记录；已有账号先读取云端记录。退出账号后，恢复原来的游客空间。',
        ],
        english: [
          'Account mode: select “登录 / 注册” to create a username and password or use an available social sign-in. No email address is required. Existing GitHub users can sign in and select “设置用户名登录” to add credentials to the same account. Google availability is shown in the sign-in window.',
          'An account syncs saved notes, familiarity ratings, notebook collections, test progress, learning plans, source preferences and your theme. Sign into the same account on another device to load them.',
          'Edits are saved on this device independently of account uploads. “立即同步” shows a busy state and checks the account. A confirmed result shows its time and revision; failures or timeouts offer an explicit retry. Even with no new edits, the button checks the account connection and reports a result.',
          'If you remember your password, use “账号登录方式” in the header to verify it and generate a replacement recovery code; the old code stops working. If you forgot your password, sign out first and choose “使用恢复码找回账号” on the sign-in screen.',
          'Learning-note mode: start without registering. Records stay in this browser. Select “带走便笺” to export a file and “读取便笺” to restore it later or on another device. Account users can export backups too.',
          'Save your recovery code when you create or link a username. Use it to set a new password if needed, then keep the replacement code. Losing both your password and code, with no other linked sign-in, means the account cannot be recovered. Export learning notes as a separate backup. Guest and account workspaces are separate. A new account can explicitly import guest records; an existing account loads its cloud records first. Signing out restores the original guest workspace.',
        ],
      },
      {
        zh: '恢复与撤销',
        en: 'Recovery and undo',
        cn: [
          '导入、替换或读取不同账号副本前，会先在当前浏览器保留完整副本，包含红黄绿、个人笔记、生词本和共享笔记草稿。若备份失败，操作会取消。每个学习空间最多保留最近两份不同内容的历史副本，超过后自动淘汰较早副本；当前记录和同步所需副本另存。普通编辑最多每 15 分钟留一份，导入／替换前立即留底；相同内容不重复保存。',
          '误导入后，可在顶部「更多」选择「撤销上次记录操作」。撤销前也会保存当前内容，可再次撤销；登录状态下会尝试同步到账号。副本保存在当前设备，不会自动出现在其他设备。',
          '需要核对历史副本时，选择顶部「更多」→「本机恢复检查（只读）」→「只读检查本机副本」→「导出检查到的全部副本」。检查页也会列出仍留在本机的冲突副本和同步基线，不会自行上传或替换。',
          '请在发生问题的同一个浏览器或桌面网页 App 内检查。副本的来源和版本号不代表它一定更新；恢复文件请先核对内容。这项保护不能补建更新前从未保存过的历史。',
        ],
        english: [
          'Before an import, replacement, or loading a different account copy, the current browser keeps a full checkpoint, including ratings, personal notes, notebook data and shared-note drafts. The operation stops if that checkpoint cannot be saved. Each workspace retains at most two distinct historical checkpoints, rotating out the oldest. Current records and required sync copies remain separate. Ordinary editing checkpoints at most once per 15 minutes; imports and replacements checkpoint immediately, without duplicate contents.',
          'Use “撤销上次记录操作” in More in the header to undo a mistaken import. The current contents are checkpointed again, so undo can be undone. Signed-in changes attempt account sync. Checkpoints remain on this device; they are not synced to other devices.',
          'To inspect retained copies, select “本机恢复检查（只读）”, scan, then export all copies. This read-only page also lists retained conflict copies and sync baselines. It never uploads or replaces records.',
          'Inspect in the same browser or installed web app where the problem occurred. Source labels and revision numbers do not prove a copy is newer. Check contents before restoring. This protection cannot recreate history that was never saved before the update.',
        ],
      },
      {
        zh: '选择词库与复习范围',
        en: 'Choose a word bank and review range',
        cn: [
          '选择「开始刷词」，打开词库，再选择 List、分类或复习范围。',
          '使用页面上的搜索、顺序／乱序、颜色筛选和揭晓按钮调整复习方式。各模块提供的控制不同，以当前页面为准。',
          '顶部保留学习规划与保存状态；我的进步、便笺导入导出、配色、账号、反馈和恢复工具集中在「更多」。程序更新时只保留当前版本的程序缓存，不删除学习记录。',
          '需要查阅操作时，可随时从顶部「更多」重新打开「使用指南」。',
        ],
        english: [
          'Select “开始刷词”, open a word bank, then choose a List, category or review range.',
          'Use the page controls to search, switch between original order and shuffle, filter ratings, or reveal content. Available controls vary by module.',
          'The header keeps the plan and save status visible. More groups progress, learning notes, themes, accounts, feedback and recovery. Updates remove older program caches while leaving learning records untouched.',
          'You can reopen this guide from More in the header at any time.',
        ],
      },
      {
        zh: '第一次使用与添加到桌面',
        en: 'First visit and adding to your home screen',
        cn: [
          '首次进入学习空间时，会显示可左右翻页的功能卡片。可以在卡片内试着标亮词、标红黄绿、写笔记、选测试答案或读回示例便笺；这些示例不会修改真实学习记录。可点击上一张／下一张、滑动或按左右方向键；点右上角 × 可随时关闭。同一浏览器关闭后不再自动弹出，也可从本指南的「翻看功能介绍」重新打开。',
          '网页版的安装提示可以关闭。iPhone／iPad：在 Safari 点分享 → 添加到主屏幕 → 添加；如有「作为 Web App 打开」选项，可开启。Android／电脑 Chrome：从浏览器菜单选择安装或添加到主屏幕。Mac Safari：文件 → 添加到程序坞。不同版本的菜单名称可能略有差别。',
          '在应用内浏览器找不到入口时，请先在 Safari／Chrome 打开。添加桌面本身不等于登录或备份；浏览器与独立网页 App 的游客存储可能分开，建议先登录账号或导出便笺。',
        ],
        english: [
          'An interactive card introduction appears on your first visit. Use Back / Next, swipe or press the arrow keys. Close it anytime with ×. Try ratings, notes, practice answers and sample learning notes inside the cards without changing real progress. Once closed, it will not reopen automatically in this browser; use “View the illustrated introduction” in this guide to revisit it.',
          'The website’s installation tip can be dismissed. On iPhone / iPad, open Safari → Share → Add to Home Screen → Add; enable Open as Web App if offered. On Android / desktop Chrome, choose Install or Add to Home Screen from the browser menu. On Mac Safari, choose File → Add to Dock. Menu labels may vary by version.',
          'If an in-app browser has no install option, open the site in Safari / Chrome. Adding an icon is not sign-in or a backup. Browser and standalone web-app guest storage may be separate, so sign in or export a learning note first.',
        ],
      },
    ],
  },
  {
    zh: '词库与资料',
    en: 'Word banks and sources',
    topics: [
      {
        zh: '词库功能一览',
        en: 'Explore the word banks',
        cn: [
          '全能词速刷：词表来自青山学堂，按 List 复习。List 后的 #序号是该词在原 List 中的位置，搜索、筛选或乱序后也不变。释义与记忆方法一起揭晓，来源保留在下方；可从单一「开始测试」入口练习与复习。',
          '等价词速刷：词表来自青山学堂，成对复习单词。可选择提示方向，分别揭晓另一词和释义。',
          'A加GRE版等价词：核心词与等价词以等宽卡片呈现。PDF 释义独立控制；每个词的笔记可分别展开。',
          'BB六选二：按上、中、下三册及 List 选择范围，两个词并排显示。等价词、释义与记忆方法分别控制；重复词保留全部出现位置，可点击定位。原文记法保留作对照。',
          'GLEE必备1500词：按词表复习单词、释义与记忆方法。',
          'GLEE词汇导图：通过导图、词表、词根词缀等视图查看词语联系，并编辑对应内容。',
          '数学词汇与数学词汇索引：按分类或资料索引复习术语，并记录红黄绿。',
          '填空高频3000词：根据网络资源整理，按范围复习，支持搜索、揭晓和红黄绿标记。',
          '阅读核心300词：每 50 词一组，显示分类来源、本义、文中义及对应选项；本模块不显示记忆笔记框。',
          '生词本：收集阅读、做题或课程中遇到的词，自行编辑并复习。具体操作见下方「使用生词本」。',
        ],
        english: [
          'General vocabulary (全能词速刷): review word lists from 青山学堂 (Qingshan Xuetang) by List. The #number after each List is the word’s original position, unchanged by searches, filters or shuffling. Meanings and memory notes are revealed together, with sources below. Two-way meaning tests and scheduled reviews are available.',
          'Equivalent pairs (等价词速刷): review word pairs from 青山学堂 (Qingshan Xuetang). Choose a prompt direction, then reveal the other word and its meaning separately.',
          'A+ GRE equivalents: core words and equivalents use equal-width cards. PDF meanings have a separate control; each word has its own expandable note.',
          'BB equivalents: select the upper, middle or lower volume and a List range. Word pairs appear side by side. Control equivalents, meanings and memory notes separately. Duplicate entries link to every occurrence; original memory methods remain for comparison.',
          'GLEE 1500: review words, meanings and memory methods by word list.',
          'GLEE word maps: explore connections through map, table and root/affix views, and edit the corresponding content.',
          'Math vocabulary and math index: review terminology by category or source index and record familiarity.',
          'Cloze high-frequency 3000: vocabulary compiled from online resources, with range selection, search, reveals and familiarity ratings.',
          'Reading core 300: groups of 50 with source categories, general and contextual meanings, and corresponding answer choices. This module has no memory-note editor.',
          'Personal notebook: collect, edit and review words from reading, questions or courses. See “Use the vocabulary notebook” below.',
        ],
      },
      {
        zh: '资料来源与视频学习',
        en: 'Sources and video study',
        cn: [
          'A+ 与 GLEE必备1500词在相关网站或 B 站有部分公开带背／带练视频。需要跟随视频学习时，可按课程或词表名称自行搜索。',
          '默认笔记大部分由作者根据 A+、GLEE 等公开视频整理，并为复习做了去重和简化。BB六选二的记忆方法来自上、中、下三份 PDF 原资料。你可以继续编辑，保留适合自己的记法。',
          'GLEE 从 List 22（含）开始的后续笔记由 AI 整理。截至本次整理时，老师的视频尚未更新到这些内容，因此这部分并非根据对应的视频讲解整理。',
        ],
        english: [
          'Some public guided memorization or practice videos for A+ and GLEE 1500 are available on the relevant websites or Bilibili. Search by course or word-list name to study alongside a video.',
          'Most default notes were organized from public A+, GLEE and other teaching videos, then deduplicated and shortened for review. BB memory methods come from the three original PDF volumes. You can edit the notes to suit the way you remember words.',
          'GLEE notes from List 22 onward were organized using AI. At the time these notes were compiled, the teacher’s videos had not yet covered those lists, so this material is not based on corresponding video explanations.',
        ],
      },
    ],
  },
  {
  "zh": "学习规划",
  "en": "Learning plans",
  "topics": [
    {
      "zh": "先生成草案，再确认采用",
      "en": "Preview, adjust and confirm",
      "cn": [
        "在首页「今天的学习」或顶部「学习规划」选择词表、开始日期和目标首轮完成日期。每天的词数上限选填，留空即可。",
        "点击「生成草案」后，先查看每天的具体 List、分类或生词本批次。可以使用系统建议，也可以选择「自己安排」，增减任务、调整日期、类型与先后顺序。",
        "只有点击「确认并采用这份安排」才会保存安排。预览、移动和移除任务都不会改变实际学习记录；随时可以返回调整。",
        "完整 List 保持原分组和实际词数。跨表同词只计一次，保留各处释义与来源。超出上限时先调整，不拆组或自动超量。"
      ],
      "english": [
        "Choose banks, a start date and a first-pass target from Daily plan. The daily word cap is optional.",
        "Generate a draft to see named Lists, source categories or notebook batches. Use suggestions or choose your own schedule; add, remove, reorder or move tasks and choose new learning or one review.",
        "Only Confirm and adopt saves the schedule. Previewing or editing tasks never changes real learning records.",
        "Original List boundaries and actual counts remain intact. Repeated spellings count once, retaining meanings and sources. Resolve cap conflicts before confirming; Lists are not split."
      ]
    },
    {
      "zh": "在原词表完成，待办自动划掉",
      "en": "Study in the original bank; the to-do checks itself",
      "cn": [
        "点击待办中的「打开词表」会进入原页面，并选好该组范围。无需再做一套逐词测试；继续使用原来的笔记、遮挡和红黄绿。",
        "标注后自动计入同一份学习进度；复习时即使仍是同一个颜色，也可以再次确认。只查看释义或编辑笔记不会代替自测。",
        "部分完成显示「已记录 X／Y 词」。本次所需的词全部记录后，任务自动打勾并划线，仍可打开词表。红黄也算完成一次自测，绿色才表示当前熟悉。",
        "首次制定计划可以选择纳入已有标记，以今天的确认作为纳入日期，不推测过去的学习时间。当天同词只计一次；当天多次反馈会保留较不熟悉的结果作为谨慎的复习建议。"
      ],
      "english": [
        "Open a to-do item to enter the original bank with the correct range. Use the existing notes, reveals and traffic lights; there is no additional planner quiz.",
        "Ratings feed the same learning history. Reaffirming the same color on a new day can record a review. Merely viewing meanings or editing notes is not an assessment.",
        "Partial tasks show X/Y words recorded. Once all required words are assessed, the item is checked and struck through. Red and yellow count as an assessment, not mastery.",
        "On first setup, optionally include existing ratings with today as their adoption date, without inventing old study dates. A word counts once per day; less-confident same-day feedback is retained for conservative advice."
      ]
    },
    {
      "zh": "按颜色建议复习，按自己的节奏调整",
      "en": "Color-based suggestions, adjusted to your pace",
      "cn": [
        "同一 List 的不同词可以有不同建议日期：红色建议次日，黄色隔 2 天，绿色隔 3 天；真实到期复习答绿后逐步延长到 7、15、30 天。提早反复标绿不会跳级。",
        "这些日期只是学习建议，可以自行安排复习；没有强制要求一天全做完。未来七天展示真实记录产生的建议和你确认的安排，不把计划当完成，也不推算遗忘概率。",
        "有漏学时，保留已经记录的部分，剩余内容生成顺延草案。若总量超过上限，系统建议把后面的整组任务往后排。先查看、调整并确认，再采用新安排。",
        "预计首轮完成日期可能延后，会明确提示。计划、待办与学习记录随当前学习空间保存，登录后同步到账号，完整便笺也能携带；只合并红黄绿不会导入整份计划。"
      ],
      "english": [
        "Words in one List can have different suggested dates: red tomorrow, yellow after two days, green after three. Actual due green reviews extend to 7, 15 and 30 days; early repeated greens do not skip levels.",
        "Dates are suggestions you may edit. The seven-day chart uses real records and confirmed reservations, never assumed future success or a claimed forgetting probability.",
        "Missed work keeps completed assessments and carries the remainder into an editable draft. Whole later tasks can move back to stay within the cap. Review and confirm before adopting changes.",
        "The first-pass estimate may move later, with a notice. Plans, to-dos and learning records travel with the signed-in workspace or a full learning-note backup. Ratings-only merge does not import the whole plan."
      ]
    }
  ]
},
  {
    zh: '复习与测试',
    en: 'Review and test',
    topics: [
      {
        zh: '进行红绿灯自测',
        en: 'Review with traffic-light self-checks',
        cn: [
          '先回忆，再揭晓释义，并按本次回忆情况标记：红＝不认识／没想起；黄＝模糊／只想起部分；绿＝熟悉／都清楚。标记随时可改。',
          '颜色表示当前自评，不代表永久掌握。可按颜色筛选复习内容；部分模块支持同时选择多个颜色。',
          '标记时，本轮复习名单保持稳定。重新筛选或打乱后，名单才会更新。红黄绿会自动保存；登录后自动同步到账号，无需另点保存。同步未完成时会保留待同步记录，并提供重试入口。',
        ],
        english: [
          'Recall the word, reveal its meaning, then rate this attempt: red for unknown or not recalled, yellow for unsure or partial recall, and green for familiar or clear recall. You can change a rating at any time.',
          'Ratings describe your current self-assessment, not permanent mastery. Filter review content by rating; some modules allow multiple colors.',
          'Rating a word does not change the current review queue. A new filter or shuffle updates the queue. Ratings save automatically and sync to your account when signed in. Pending changes are kept if sync fails; use Retry to try again.',
        ],
      },
      {
        zh: '展开笔记与标亮单词',
        en: 'Open notes and highlight words',
        cn: [
          'A+ 单词：单击朗读，双击标亮不熟悉的词，再次双击取消标亮。',
          '选择单词旁的「▸ 笔记」，仅展开该词的笔记，不会同时展开其他单词。也可使用「展开全部／收起全部」统一控制笔记。',
          'PDF 释义、等价词和笔记使用各自的显示控制；改变一个开关，不会自动展开其他内容。',
        ],
        english: [
          'In A+, click a word to hear it. Double-click to highlight it as unfamiliar; double-click again to clear the highlight.',
          'Select “▸ 笔记” beside a word to open only its note. Use the expand-all or collapse-all control to change all notes together.',
          'PDF meanings, equivalents and notes have separate visibility controls. Changing one does not automatically reveal the others.',
        ],
      },
      {
        zh: '编辑记忆方法',
        en: 'Edit memory methods',
        cn: [
          '在支持笔记的模块中，可直接编辑单词的记忆方法。同一个词在自己的不同模块共用一份笔记；保存后，其他位置同步显示。',
          '可以先修改多个词，再选择「保存全部笔记／保存全部记忆方法」。有保存按钮时，请先提交编辑，再确认顶部的保存状态。未提交的草稿不保证包含在便笺中。',
          '共享仅发生在你自己的模块之间。你的编辑不会更改其他使用者的笔记，也不会改写大家使用的默认资料。默认资料未导入作者在个人网站保存的私人修改。',
        ],
        english: [
          'Edit a word’s memory method in any module that supports notes. The same word uses one personal note across your modules; saving updates its other appearances.',
          'You can edit several words before selecting “保存全部笔记／保存全部记忆方法” (Save all notes/memory methods). Submit edits before checking the save status in the header. Unsubmitted drafts are not guaranteed to appear in an exported file.',
          'Sharing applies only to your own modules. Your edits do not change other learners’ notes or the public defaults. Private edits saved on the creator’s personal website have not been imported as public defaults.',
        ],
      },
      {
        zh: '使用生词本',
        en: 'Use the vocabulary notebook',
        cn: [
          '收集单词：创建一次收集，填写文章、题目或课程来源及日期，以便回看语境。',
          '查找与添加：在搜索框查询各词库，按来源筛选结果。同一单词可勾选多份来源的解释，合并到一个词条下；也可自行添加新词。',
          '选择来源：在「词库来源优先顺序」中上下调整排序。词库无结果时，词典区自动沿用已输入的单词；选择词典释义后仍可修改。',
          '查阅词典：添加生词时展开「查词典或补充这一个词」，已有生词展开「补查词典」。点击「韦氏词典」或「海词词典」可在新窗口查当前单词，返回后继续编辑；外部释义不会自动填入或覆盖笔记。',
          '编辑与复习：编辑模式可修改单词、释义和来源。复习模式逐行揭晓释义与笔记，并支持红黄绿、颜色筛选和快捷键；当前词会滚到屏幕中间。来源以较浅颜色显示，便于阅读释义。',
          '保存与撤销：选择「保存到当前工作区」保存生词本修改。记忆方法使用对应的「保存全部笔记」。误移除单词时，可选择「撤销移除」。',
        ],
        english: [
          'Collect words: create a collection with the article, question or course source and date to keep its context.',
          'Search and add: search across word banks and filter by source. Select definitions from several sources to combine them under one word, or add a new word manually.',
          'Set source preferences: reorder “词库来源优先顺序”. If the word banks have no match, the dictionary opens with the same query. You can edit a selected dictionary definition.',
          'Look up a word: expand “查词典或补充这一个词” when adding a word, or “补查词典” on an existing entry. Select “韦氏词典” (Merriam-Webster) or “海词词典” (Dict.cn) to open its official entry in a new window. Return to keep editing; external definitions are not automatically inserted or used to overwrite notes.',
          'Edit and review: edit words, meanings and sources in edit mode. Review mode reveals meanings and notes row by row, with ratings, filters and shortcuts. The active word scrolls toward the center. Subdued source labels keep meanings clear.',
          'Save and undo: select “保存到当前工作区” to save notebook changes. Memory notes use their own Save all control. Select “撤销移除” to undo an accidental removal.',
        ],
      },
      {
  "zh": "一个清楚的开始测试入口",
  "en": "One clear Start test entry",
  "cn": [
    "A+ 保留「速刷与笔记／开始测试」里的原有等价词测试，不再额外提供另一套双向释义入口。先选释义，再选等价词；第一步答错或不确定就直接显示答案和笔记，跳过第二步。",
    "BB 保留一个简单等价词测试：选择 List 范围和顺序后，看单词，从六个词中选同义词。提交后直接看释义、正确词和记忆笔记，不再先做另一轮释义选择。",
    "全能词保留一个「开始测试」入口，可选范围、方向和顺序。测试结果与可继续的题目保存在当前学习空间。",
    "测试是可选的。学习计划直接使用词表里的红绿灯记录，不要求先参加测试。"
  ],
  "english": [
    "A+ keeps its original equivalents test under the Scan/notes–Start test switch, without a second meaning-test entry. A wrong or uncertain meaning shows feedback and notes immediately, skipping synonym selection.",
    "BB has one simple equivalents test: choose a List range and order, then pick a synonym from six words. Feedback shows meanings, the correct word and memory notes. There is no preliminary meaning question.",
    "General vocabulary keeps one Start test entry with range, direction and order settings. Tests can be saved and resumed in the current workspace.",
    "Testing is optional. Learning plans use ratings made in the bank and do not require taking a test first."
  ]
},
      {
        zh: '使用 A+ 完整测试与到期复习',
        en: 'Use full A+ tests and scheduled review',
        cn: [
          'A+ 的「速刷与笔记／开始测试」切换区提供完整两步测试：先选核心词释义，再从六个词中选同义词。选词支持单选或不定项。',
          '第一步答错或不确定时，直接显示答案并跳过第二步。仅对实际作答的选词记录漏选与误选，相关选项会在下次保留。出错后需连续两次两步全对，再次出错则重新累计。',
          'A+ 完整测试保留原有长期计划，复习间隔为 1、2、4、7、15、30 天。复习出错会重置该词的计划，第二天重新复习。测试的长期记录保留；学习规划仍可以只用原词表的红绿灯完成。',
          '干扰词按已有同义关系过滤。如发现有争议的选项，可在反馈中注明核心词与选项。',
        ],
        english: [
          'The A+ “速刷与笔记／开始测试” switch opens the full two-step test: select the core word’s meaning, then synonyms from six options. Synonym questions can use single-answer or select-all-that-apply mode.',
          'A wrong or uncertain meaning shows the answer and skips the second step. Missed or incorrect synonyms are recorded only for a synonym step you attempted, and those options remain for the next appearance. Recovery requires two consecutive fully correct two-step attempts; another error resets the streak.',
          'The full A+ test keeps its original schedule with intervals of 1, 2, 4, 7, 15 and 30 days. A review error resets the word for the next day. The original test history remains available; the daily planner can still be completed using bank self-ratings alone.',
          'Distractors are filtered using known synonym relationships. Report a debatable option through Feedback, including the core word and choices.',
        ],
      },
      {
        zh: '使用快捷键与朗读',
        en: 'Use shortcuts and pronunciation',
        cn: [
          '↑／←：上一词或上一组。↓／→：下一词或下一组。Space：朗读。Enter：揭晓、提交或继续。1／2／3：标记红／黄／绿。具体作用以当前模块的提示为准。',
          '在编辑框中输入时，不会触发刷词快捷键。',
          '点击支持朗读的英文词可听发音，声音取决于设备和浏览器。BB 中按 Space 会朗读同组第一个词。',
        ],
        english: [
          '↑/← moves to the previous word or group; ↓/→ moves to the next. Space pronounces. Enter reveals, submits or continues. 1/2/3 applies red/yellow/green. Follow the hints in the current module.',
          'Typing in an editor does not trigger review shortcuts.',
          'Click words with pronunciation support to hear them. Voices depend on your device and browser. In BB, Space pronounces the first word in the pair.',
        ],
      },
      {
        zh: '查看我的进步',
        en: 'View your progress',
        cn: [
          '从首页或顶部打开「我的进步」，查看练习词数、自测熟悉词数和已完成测试轮次。',
          '进度条展示练习记录最多的三个板块，优先显示绿色的熟悉词数，同时保留模糊、不认识和未标记的数量。',
          '同词去重；同一词的标记不一致时，按较不熟悉的状态计算。绿色表示自评熟悉，不代表永久掌握。',
          '测试轮次从该功能加入后开始累积；旧版仅计仍可识别的已保存完成轮次。进步数据随当前账号或便笺保存。',
        ],
        english: [
          'Open “我的进步” from the home page or header to see practiced words, self-rated familiar words and completed test rounds.',
          'Progress bars show the three modules with the most recorded practice. Familiar words appear first, alongside unsure, unknown and unrated counts.',
          'Words are deduplicated. Conflicting ratings use the less-familiar state. Green means self-rated familiarity, not permanent mastery.',
          'Completed rounds accumulate from the introduction of this feature, supplemented by identifiable older saved rounds. Progress travels with your current account or learning-note file.',
        ],
      },
    ],
  },
  {
    zh: '保存与使用设置',
    en: 'Save and customize',
    topics: [
      {
        zh: '确认保存状态',
        en: 'Check the save status',
        cn: [
          '顶部显示「已存到这台设备」时，游客记录已保存在当前浏览器；显示「已保存到账号」时，账号记录已完成云端同步。',
          '编辑区有保存按钮时，先提交编辑，再查看顶部状态。同步异常时，先导出便笺留底，再重试保存。',
          '新设备的空白记录不会直接覆盖已有云端记录。两台设备标记不同的词会按词合并；同一词以较新的修改时间为准。旧版记录无法判断先后，或同一笔记发生冲突时，会保留本机副本，供导出与核对。',
        ],
        english: [
          '“已存到这台设备” confirms browser storage for a guest workspace. “已保存到账号” confirms completed cloud sync for an account.',
          'Submit edits wherever a save button is provided, then check the header status. If sync fails, export a backup before retrying.',
          'Empty records on a new device do not silently replace existing cloud records. Different-word ratings from multiple devices are merged. For the same word, the newer recorded edit wins. Ambiguous older ratings or conflicting notes preserve a local copy for export and review.',
        ],
      },
      {
        zh: '导出、读取便笺与换设备',
        en: 'Export, restore and move between devices',
        cn: [
          '导出：选择「带走便笺」，保存当前学习空间的文件。便笺包含已保存的笔记、红黄绿、生词本、测试与复习记录、学习计划与逐词记录、来源偏好、昵称及配色。文件名包含昵称和导出日期时间。',
          '读取：选择「读取便笺」并选取文件。可选择「合并红黄绿记录」，保留两边不同词的标记，以及当前笔记和设置；或选择「替换整份记录」恢复便笺中的全部内容。替换前请先导出当前记录。旧版 GRE JSON 备份仍可读取。',
          '换设备：可登录同一账号读取云端进度，也可导出便笺后在另一设备导入。',
          '便笺是普通数据文件，请妥善保管。清除网站数据、无痕浏览或浏览器清理可能导致本地记录丢失；同一浏览器配置下的游客共用一份记录。',
        ],
        english: [
          'Export: select “带走便笺” to save a file for the current workspace. It contains saved notes, ratings, notebook collections, tests, review schedules, learning plans and word records, source preferences, nickname and theme. The filename includes your nickname and the export date/time.',
          'Restore: select “读取便笺” and choose a file. Choose Merge ratings to combine familiarity ratings while keeping current notes and settings, or Replace all records to restore the entire file. Export your current records before replacing them. Older GRE JSON backups are supported.',
          'Change devices: sign into the same account to load cloud progress, or export a learning-note file and import it on the other device.',
          'Keep the file safe. Clearing site data, private browsing or browser cleanup can remove local records. Guests sharing one browser profile share its workspace.',
        ],
      },
      {
        zh: '更换配色与安装到主屏幕',
        en: 'Change themes and install to the home screen',
        cn: [
          '打开「配色」，选择雪林晚霞、湖畔鸢尾、暮色雪林或苹果古纸。四个色块分别对应背景、卡片、主按钮、选中与高亮。配色随账号和便笺保存，红黄绿的学习含义保持不变。',
          '手机、iPad 和电脑均可通过浏览器使用。支持的浏览器可选择「添加到主屏幕／安装应用」。目前尚未上架应用商店，完整离线使用暂不保证。',
        ],
        english: [
          'Open Themes to choose Snowy Sunset, Lakeside Iris, Twilight Forest or Apple Paper. The four swatches represent background, cards, primary buttons and selection/highlights. Themes travel with accounts and files; the meaning of familiarity ratings stays the same.',
          'Use Lemnota in a phone, iPad or computer browser. Choose Add to Home Screen or Install App where supported. It is not currently listed in app stores, and full offline use is not guaranteed.',
        ],
      },
    ],
  },
  {
    zh: '反馈与隐私',
    en: 'Feedback and privacy',
    topics: [
      {
        zh: '提交建议与查看作者回复',
        en: 'Send feedback and read replies',
        cn: [
          '选择顶部「意见反馈 / Feedback」或首页「写一条意见」，打开反馈面板。',
          '未登录：提交的建议直接公开。已登录：可选择「公开」或「私人」，默认私人。提交前请确认可见范围。',
          '公开建议与作者回复所有人都能查看，不展示提交者的账号身份。私人反馈与回复仅提交者和作者可见；登录同一账号可在其他设备查看。已有反馈继续保持私人，不会自动公开。',
          '描述问题时，可注明模块、操作步骤、设备或词条。公开内容请勿包含密码、联系方式或其他敏感信息。',
          '作者可从「统计后台 → 用户反馈」回复。返回反馈面板，选择「刷新」查看回复；目前不发送通知邮件。',
        ],
        english: [
          'Select “意见反馈 / Feedback” in the header or “写一条意见” on the home page to open Feedback.',
          'Guests submit public suggestions. Signed-in users can choose Public or Private, with Private selected by default. Check visibility before submitting.',
          'Everyone can read public suggestions and author replies; the submitter’s account identity is not displayed. Private feedback and replies are visible only to the submitting account and the author. Sign into the same account to read them on another device. Existing feedback remains private.',
          'Include the module, steps, device or word when describing a problem. Do not include passwords, contact details or other sensitive information in public content.',
          'The author replies through Statistics → User feedback. Return to Feedback and select Refresh to check replies. Notification emails are not sent.',
        ],
      },
      {
        zh: '了解使用统计与隐私范围',
        en: 'Understand analytics and privacy',
        cn: [
          '进入学习前，需同意基本使用统计。记录包括日期、使用功能、操作次数和技术标识，不包含笔记正文、便笺内容或具体答题内容。',
          '统计记录长期保留，用于功能改进，以及项目介绍、作品集或研究中的汇总展示；不用于广告或其他商业用途。',
          '主动提交的反馈单独保存，按提交时选择的公开或私人范围展示。后台统计、私人反馈访问和作者回复权限均由服务器验证。',
          '可在「使用统计」撤回同意并退出学习。撤回后，仍可导出或清空自己的学习空间。',
        ],
        english: [
          'Learning requires agreement to basic analytics. Records include dates, features used, action counts and technical identifiers. They exclude note text, learning-note file contents and specific test answers.',
          'Analytics records are retained long-term to improve features and support aggregate project, portfolio or research presentations. They are not used for advertising or other commercial purposes.',
          'Feedback is stored separately and shown according to its selected public or private visibility. The server verifies access to analytics administration, private feedback and author replies.',
          'Withdraw agreement through Usage analytics to leave learning. Exporting or clearing your own workspace remains available.',
        ],
      },
    ],
  },
];

export default function Guide({onTour}:{onTour?:()=>void}={}) {
  const [english, setEnglish] = useState(false);

  return (
    <div className="studyGuide fullGuide" lang={english ? 'en' : 'zh-CN'}>
      <div className="aboutLanguage" role="group" aria-label="指南语言 / Guide language">
        <button aria-pressed={!english} onClick={() => setEnglish(false)}>中文</button>
        <button aria-pressed={english} onClick={() => setEnglish(true)}>English</button>
      </div>
      {onTour&&<button className="guideTourButton" onClick={onTour}>{english?'View the illustrated introduction →':'翻看功能介绍 →'}</button>}
      <p>{english
        ? 'Choose how to save your progress, then open a topic for instructions. This guide is always available in the header.'
        : '先选择进度保存方式，再展开对应主题查看操作。顶部「使用指南」可随时查阅。'}</p>
      {groups.map((group, groupIndex) => (
        <section key={group.zh} aria-labelledby={`guide-group-${groupIndex}`}>
          <h3 id={`guide-group-${groupIndex}`}>{english ? group.en : group.zh}</h3>
          {group.topics.map((topic, topicIndex) => (
            <details className="guideSection" key={topic.zh} open={groupIndex === 0 && topicIndex === 0}>
              <summary>{english ? topic.en : topic.zh}</summary>
              {(english ? topic.english : topic.cn).map(text => <p key={text}>{text}</p>)}
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
