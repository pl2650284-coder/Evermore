import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import { CoupleProvider } from '@/lib/couple';
import SyncScheduler from '@/components/SyncScheduler';
import { MusicProvider } from '@/components/MusicProvider';
import SoundButton from '@/components/SoundButton';

export const metadata: Metadata = {
  title: 'Evermore - 恋爱数字博物馆',
  description: '记录我们的恋爱故事，收藏每一个珍贵瞬间',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <CoupleProvider>
              <MusicProvider>
                {children}
                <SoundButton />
                <SyncScheduler />
              </MusicProvider>
            </CoupleProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
