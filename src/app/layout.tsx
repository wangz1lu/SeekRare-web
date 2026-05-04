import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SeekRare - 罕见病 AI 诊断平台',
    template: '%s | SeekRare',
  },
  description:
    'SeekRare 是一个基于大语言模型的三阶段罕见病诊断系统，通过分析患者临床表型和基因组变异数据，提供个性化的候选变异排序结果。',
  keywords: [
    'SeekRare',
    '罕见病诊断',
    '基因变异分析',
    'VCF分析',
    'HPO',
    '基因诊断',
    '精准医疗',
  ],
  authors: [{ name: 'Wang Zelong', url: 'https://github.com/wangz1lu/SeekRare' }],
  generator: 'Coze Code',
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: 'SeekRare - 罕见病 AI 诊断平台',
    description:
      '基于大语言模型的三阶段罕见病诊断系统，提供个性化的候选变异排序结果。',
    url: 'https://seekrare.dev',
    siteName: 'SeekRare',
    locale: 'zh_CN',
    type: 'website',
    // images: [
    //   {
    //     url: '',
    //     width: 1200,
    //     height: 630,
    //     alt: '扣子编程 - 你的 AI 工程师',
    //   },
    // ],
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Coze Code | Your AI Engineer is Here',
  //   description:
  //     'Build and deploy full-stack applications through AI conversation. No env setup, just flow.',
  //   // images: [''],
  // },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
