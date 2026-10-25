import { defineConfigWithTheme, type DefaultTheme, type HeadConfig } from 'vitepress'
import { getLatestRelease, REPO, type LatestRelease } from './latest-release.mjs'

export interface ThemeConfig extends DefaultTheme.Config {
  latestRelease: LatestRelease
  // Control Tower 站與它的安裝頁；頁面內文經 CtPortalLink 元件取用
  ctPortalUrl: string
  ctInstallUrl: string
}

// 分享卡片與 sitemap 都要絕對網址
const SITE_URL = 'https://gowerlin.github.io/better-agent-terminal/'

// Control Tower 站（設計理念與使用說明）：網址只在這裡寫一次
const CT_PORTAL_URL = 'https://gowerlin.github.io/Control-Tower/'
// 取得與安裝方式只寫在 Control Tower 站的安裝頁
const CT_INSTALL_URL = CT_PORTAL_URL + 'install'

// 404 頁的說明：VitePress 內建的是英文 Not Found
const NOT_FOUND_DESCRIPTION = '找不到這個頁面，網址可能已經移除或改名。請回 Better Agent Terminal 首頁，或從上方選單找你要的內容。'

// cleanUrls：cases.md → cases、remote/index.md → remote/、index.md → 首頁
function pageUrl(relativePath: string): string {
  return SITE_URL + relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
}

export default async () => {
  const latestRelease = await getLatestRelease()

  return defineConfigWithTheme<ThemeConfig>({
    base: '/better-agent-terminal/',
    lang: 'zh-TW',
    title: 'Better Agent Terminal',
    description: '一個塔台，指揮整隊 AI Agent：Better Agent Terminal 與 BMad Control Tower 把開單、派工、回報、提問、收尾串成一個會自己推進的循環。',
    cleanUrls: true,

    sitemap: {
      hostname: SITE_URL
    },

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
      ],
      // 分享卡片：每頁共用的部分；標題、說明、網址在 transformHead 依頁面帶入
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'Better Agent Terminal' }],
      ['meta', { property: 'og:locale', content: 'zh_TW' }],
      ['meta', { property: 'og:image', content: `${SITE_URL}og-card.png` }],
      ['meta', { property: 'og:image:width', content: '1200' }],
      ['meta', { property: 'og:image:height', content: '630' }],
      ['meta', { property: 'og:image:alt', content: 'Better Agent Terminal：一個塔台，指揮整隊 AI Agent' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:image', content: `${SITE_URL}og-card.png` }]
    ],

    // 每頁的分享標題 / 說明取自頁面 frontmatter（沒寫就用站名與站點說明，同 <title> / <meta name="description">）
    transformHead({ pageData, title, description }) {
      const pageDescription = pageData.isNotFound ? NOT_FOUND_DESCRIPTION : description
      const head: HeadConfig[] = [
        ['meta', { property: 'og:title', content: title }],
        ['meta', { property: 'og:description', content: pageDescription }],
        ['meta', { name: 'twitter:title', content: title }],
        ['meta', { name: 'twitter:description', content: pageDescription }]
      ]
      if (pageData.isNotFound) {
        // head 裡有 meta description 時，VitePress 不再輸出內建的那一個
        head.push(['meta', { name: 'description', content: NOT_FOUND_DESCRIPTION }])
      } else {
        head.push(['meta', { property: 'og:url', content: pageUrl(pageData.relativePath) }])
      }
      return head
    },

    themeConfig: {
      latestRelease,
      ctPortalUrl: CT_PORTAL_URL,
      ctInstallUrl: CT_INSTALL_URL,

      logo: '/logo.svg',

      nav: [
        { text: '安裝', link: '/install' },
        { text: '功能', link: '/features' },
        { text: '遠端開發', link: '/remote/' },
        {
          text: '與 Control Tower 協作',
          items: [
            { text: '把腦力留給判斷', link: '/why' },
            { text: '分工與流程', link: '/control-tower' },
            { text: 'Control Tower 功能導覽', link: '/control-tower-tour' },
            { text: 'Control Tower 站', link: CT_PORTAL_URL }
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
          text: '與 Control Tower 協作',
          items: [
            { text: '把腦力留給判斷', link: '/why' },
            { text: '分工與流程', link: '/control-tower' },
            { text: 'Control Tower 功能導覽', link: '/control-tower-tour' },
            { text: '實戰案例', link: '/cases' },
            { text: 'Control Tower 站', link: CT_PORTAL_URL }
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
