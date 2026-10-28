import type { Metadata } from 'next';
import { AuthScreen } from '@/components/AuthScreen';

export const metadata: Metadata = {
  title: 'AzLottery | စာရင်းသွင်းရန်',
  description: 'AzLottery database တွင် ဖုန်းနံပါတ် သို့မဟုတ် အီးမေးလ်နှင့် စကားဝှက်ဖြင့် အကောင့်ဖွင့်ပါ။',
};

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
