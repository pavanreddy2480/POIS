import React, { useState } from 'react';
import PA1Demo from './demos/PA1Demo';
import PA2Demo from './demos/PA2Demo';
import PA3Demo from './demos/PA3Demo';
import PA4Demo from './demos/PA4Demo';
import PA5Demo from './demos/PA5Demo';
import PA6Demo from './demos/PA6Demo';
import PA7Demo from './demos/PA7Demo';
import PA8Demo from './demos/PA8Demo';
import PA9Demo from './demos/PA9Demo';
import PA10Demo from './demos/PA10Demo';
import PA11Demo from './demos/PA11Demo';
import PA12Demo from './demos/PA12Demo';
import PA13Demo from './demos/PA13Demo';
import PA14Demo from './demos/PA14Demo';
import PA15Demo from './demos/PA15Demo';
import PA16Demo from './demos/PA16Demo';
import PA17Demo from './demos/PA17Demo';
import PA18Demo from './demos/PA18Demo';
import PA19Demo from './demos/PA19Demo';
import PA20Demo from './demos/PA20Demo';

const DEMOS = [
  { id: 'PA1',  label: 'PA#1 OWF/PRG',    Component: PA1Demo },
  { id: 'PA2',  label: 'PA#2 GGM Tree',   Component: PA2Demo },
  { id: 'PA3',  label: 'PA#3 IND-CPA',    Component: PA3Demo },
  { id: 'PA4',  label: 'PA#4 Modes',      Component: PA4Demo },
  { id: 'PA5',  label: 'PA#5 MAC Forge',  Component: PA5Demo },
  { id: 'PA6',  label: 'PA#6 Malleability', Component: PA6Demo },
  { id: 'PA7',  label: 'PA#7 Merkle-Damgård', Component: PA7Demo },
  { id: 'PA8',  label: 'PA#8 DLP Hash',   Component: PA8Demo },
  { id: 'PA9',  label: 'PA#9 Birthday',   Component: PA9Demo },
  { id: 'PA10', label: 'PA#10 HMAC',      Component: PA10Demo },
  { id: 'PA11', label: 'PA#11 DH Exchange', Component: PA11Demo },
  { id: 'PA12', label: 'PA#12 RSA',       Component: PA12Demo },
  { id: 'PA13', label: 'PA#13 Miller-Rabin', Component: PA13Demo },
  { id: 'PA14', label: 'PA#14 Håstad',    Component: PA14Demo },
  { id: 'PA15', label: 'PA#15 Signatures', Component: PA15Demo },
  { id: 'PA16', label: 'PA#16 ElGamal',   Component: PA16Demo },
  { id: 'PA17', label: 'PA#17 CCA-PKC',   Component: PA17Demo },
  { id: 'PA18', label: 'PA#18 OT',        Component: PA18Demo },
  { id: 'PA19', label: 'PA#19 Secure AND', Component: PA19Demo },
  { id: 'PA20', label: 'PA#20 MPC',       Component: PA20Demo },
];

export default function DemoSection() {
  const [active, setActive] = useState('PA1');
  const demo = DEMOS.find(d => d.id === active);

  return (
    <div className="demo-section">
      <div className="demo-tab-bar">
        {DEMOS.map(d => (
          <button
            key={d.id}
            className={`demo-tab${active === d.id ? ' active' : ''}`}
            onClick={() => setActive(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="demo-content">
        {demo && <demo.Component />}
      </div>
    </div>
  );
}
