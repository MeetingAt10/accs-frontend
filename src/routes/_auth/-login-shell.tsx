import { motion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import building from '@/assets/sign-in/building.png'
import logo from '@/assets/sign-in/accs-logo-white.svg'
import chatIcon from '@/assets/sign-in/icon-chat.svg'
import lockIcon from '@/assets/sign-in/icon-document-lock.svg'
import scheduleIcon from '@/assets/sign-in/icon-schedule.svg'
import stars from '@/assets/sign-in/starfield.svg'

import { rise } from './-auth-shell'
import { fieldMood, MascotProvider, MascotSprite, useMascot } from './-mascot'

import './auth.css'
import './login.css'

const facts = [
  { icon: chatIcon, label: 'Join the CCS Forum!' },
  { icon: scheduleIcon, label: 'Faculty consultation, make an appointment!' },
  { icon: lockIcon, label: 'Send confidential concerns anonymously!' },
]

const enter = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }

/**
 * Sign-in layout from the Figma "User Login" frame: brand panel with the ACCS logo, form on white. The panel takes the
 * landing site's night sky and starfield; the form sits on a card with the lion and cub peeking over its top edge,
 * idling and reacting to the form (`-mascot.tsx`).
 */
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <MascotProvider>
        <LoginLayout>{children}</LoginLayout>
      </MascotProvider>
    </MotionConfig>
  )
}

function LoginLayout({ children }: { children: ReactNode }) {
  const { mood, setField } = useMascot()
  // Focus moves and the show-password button decide the field pose; read it after React has applied the change.
  const track = () => requestAnimationFrame(() => setField(fieldMood(document.activeElement)))
  return (
    <div className="au lg">
      <aside className="lg-brand" aria-label="About ACCS">
        <div className="lg-brand__stars" aria-hidden style={{ backgroundImage: `url(${stars})` }} />
        <div className="lg-brand__photo" aria-hidden>
          <img src={building} alt="" />
        </div>
        <motion.div className="lg-brand__inner" variants={enter} initial="hidden" animate="show">
          <motion.img
            className="lg-brand__logo"
            src={logo}
            width={311}
            height={145}
            alt="ACCS: Your Access to the College of Computer Studies"
            variants={rise}
          />
          <motion.p className="lg-brand__headline" variants={rise}>
            The CCS Office, Now Online!
          </motion.p>
          <motion.ul className="lg-brand__facts" variants={enter}>
            {facts.map((fact) => (
              <motion.li key={fact.label} variants={rise}>
                <span className="lg-brand__icon">
                  <img src={fact.icon} alt="" />
                </span>
                {fact.label}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </aside>
      <main className="au-main lg-main">
        <div className="au-col lg-col">
          {/* The mascots peek over the top edge of the form card, next to the fields they react to. */}
          <div className="lg-perch" aria-hidden>
            <motion.div
              className="lg-perch__cub"
              initial={{ y: '45%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <MascotSprite name="cub" mood={mood} delay={0.4} />
            </motion.div>
            <motion.div
              className="lg-perch__lion"
              initial={{ y: '45%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <MascotSprite name="lion" mood={mood} />
            </motion.div>
          </div>
          <div className="lg-card" onFocus={track} onBlur={track} onClick={track}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
