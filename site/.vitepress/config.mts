import { defineConfigWithTheme, type DefaultTheme } from 'vitepress'
import { getLatestRelease, REPO, type LatestRelease } from './latest-release.mjs'

export interface ThemeConfig extends DefaultTheme.Config {
  latestRelease: LatestRelease
}

export default async () => {
  const latestRelease = await getLatestRelease()

  return defineConfigWithTheme<ThemeConfig>({
    base: '/better-agent-terminal/',
    lang: 'zh-TW',
    title: 'Better Agent Terminal',
    description: '一個塔台，指揮整隊 AI Agent：Better Agent Terminal 與 BMad Control Tower 把開單、派工、回報、提問、收尾串成一個會自己推進的循環。',
    cleanUrls: true,

    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: '/better-agent-terminal/logo.svg' }],
      ['meta', { name: 'theme-color', content: '#10172e' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
      [
        'link',
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Chiron+Hei+HK:wght@900&family=Martian+Mono:wght@300;400;500&family=Noto+Sans+TC:wght@400;500;700;900&display=swap'
        }
      ]
    ],

    themeConfig: {
      latestRelease,

      logo: '/logo.svg',

      nav: [
        { text: '安裝', link: '/install' },
        { text: '功能', link: '/features' },
        { text: '遠端開發', link: '/remote/' },
        {
          text: 'BAT × Control Tower',
          items: [
            { text: '分工與流程', link: '/control-tower' },
            { text: 'Control Tower 功能導覽', link: '/control-tower-tour' }
          ]
        },
        { text: '實戰案例', link: '/cases' },
        {
          text: '參考',
          items: [
            { text: '版本對照', link: '/compatibility' },
            { text: '更版紀錄', link: '/releases' },
            { text: '常見問題', link: '/faq' },
            { text: '回報與協助測試', link: '/contribute' }
          ]
        }
      ],

      sidebar: [
        {
          text: '開始使用',
          items: [
            { text: '安裝', link: '/install' },
            { text: '功能', link: '/features' }
          ]
        },
        {
          text: '遠端開發',
          items: [
            { text: '總覽', link: '/remote/' },
            { text: 'WSL', link: '/remote/wsl' },
            { text: 'SSH', link: '/remote/ssh' },
            { text: 'Docker', link: '/remote/docker' }
          ]
        },
        {
          text: 'BAT × Control Tower',
          items: [
            { text: '分工與流程', link: '/control-tower' },
            { text: 'Control Tower 功能導覽', link: '/control-tower-tour' },
            { text: '實戰案例', link: '/cases' }
          ]
        },
        {
          text: '參考',
          items: [
            { text: '版本對照', link: '/compatibility' },
            { text: '更版紀錄', link: '/releases' },
            { text: '常見問題', link: '/faq' },
            { text: '回報與協助測試', link: '/contribute' }
          ]
        }
      ],

      socialLinks: [
        { icon: 'github', link: `https://github.com/${REPO}`, ariaLabel: 'GitHub' }
      ],

      // 頁尾只在沒有側欄的頁面（首頁）顯示，這是 VitePress 預設主題的行為
      footer: {
        message: '以 MIT 授權釋出',
        copyright:
          '致謝上游：<a href="https://github.com/tony1223/better-agent-terminal" target="_blank" rel="noreferrer">TonyQ 的原始專案</a>、' +
          '<a href="https://github.com/scandnavik/better-agent-terminal" target="_blank" rel="noreferrer">scandnavik 的 fork</a>，' +
          `以及<a href="https://github.com/${REPO}#%E8%87%B4%E8%AC%9D" target="_blank" rel="noreferrer">所有原始貢獻者</a>`
      },

      search: {
        provider: 'local',
        options: {
          translations: {
            button: {
              buttonText: '搜尋',
              buttonAriaLabel: '搜尋'
            },
            modal: {
              displayDetails: '顯示詳細清單',
              resetButtonTitle: '清除搜尋',
              backButtonTitle: '關閉搜尋',
              noResultsText: '找不到相關結果',
              footer: {
                selectText: '選擇',
                selectKeyAriaLabel: 'Enter',
                navigateText: '切換',
                navigateUpKeyAriaLabel: '向上',
                navigateDownKeyAriaLabel: '向下',
                closeText: '關閉',
                closeKeyAriaLabel: 'Esc'
              }
            }
          }
        }
      },

      outline: {
        level: [2, 3],
        label: '本頁目錄'
      },
      docFooter: {
        prev: '上一頁',
        next: '下一頁'
      },
      lastUpdated: {
        text: '最後更新'
      },
      notFound: {
        title: '找不到頁面',
        quote: '這個網址沒有對應的頁面，可能已經移除或改名。',
        linkLabel: '回首頁',
        linkText: '回首頁'
      },
      darkModeSwitchLabel: '外觀',
      lightModeSwitchTitle: '切換為淺色',
      darkModeSwitchTitle: '切換為深色',
      sidebarMenuLabel: '選單',
      returnToTopLabel: '回到頂端',
      langMenuLabel: '切換語言',
      skipToContentLabel: '跳至內容',
      externalLinkIcon: true
    }
  })
}
