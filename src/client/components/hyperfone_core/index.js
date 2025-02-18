import { ChatApp } from './ChatApp'
import { WebBrowser } from './WebBrowser'

export const coreApps = [
  {
    id: 'chat',
    name: 'Chat',
    icon: '💬',
    component: ChatApp
  },
  {
    id: 'browser',
    name: 'Browser',
    icon: '🌐',
    component: WebBrowser
  }
] 