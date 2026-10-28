'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowRight, Gift } from 'lucide-react';

type PromotionViewProps = { onNavigate: (tab: string) => void };

export const PromotionView: React.FC<PromotionViewProps> = ({ onNavigate }) => (
  <div className="promotion-page">
    <header className="promotion-heading">
      <span className="promotion-eyebrow"><Gift /> Promotion</span>
      <h1>Promotion &amp; rewards</h1>
      <p>Current promotion details will appear here when they are available in AzLottery.</p>
    </header>
    <section className="promotion-card">
      <div className="promotion-card-copy">
        <span className="promotion-card-kicker">AZLOTTERY</span>
        <h2>Rewards center</h2>
        <p>Check this page for official reward information. No balance or promotion is added from this screen.</p>
        <button type="button" onClick={() => onNavigate('home')}>Back to Home <ArrowRight /></button>
      </div>
      <Image src="/cklottery/png/rewardCenter-BO-n76hA.png" alt="Rewards center" width={96} height={96} />
    </section>
  </div>
);
