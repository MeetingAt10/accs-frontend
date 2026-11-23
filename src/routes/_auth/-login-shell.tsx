import { motion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import building from '@/assets/sign-in/building.png'
import logo from '@/assets/sign-in/accs-logo-white.svg'
import chatIcon from '@/assets/sign-in/icon-chat.svg'
import lockIcon from '@/assets/sign-in/icon-document-lock.svg'
import scheduleIcon from '@/assets/sign-in/icon-schedule.svg'
import lion from '@/assets/sign-in/lion.svg'

import { rise } from './-auth-shell'

import './auth.css'
import './login.css'

const facts = [
  { icon: chatIcon, label: 'Join the CCS Forum!' },
  { icon: scheduleIcon, label: 'Faculty consultation, make an appointment!' },
  { icon: lockIcon, label: 'Send confidential concerns anonymously!' },
]

const enter = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }

/** Sign-in layout from the Figma "User Login" frame: navy brand panel with the ACCS logo and lion, form on white. */
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="au lg">
        <aside className="lg-brand" aria-label="About ACCS">
          <div className="lg-brand__photo" aria-hidden>
            <img src={building} alt="" />
          </div>
          <motion.img
            className="lg-brand__lion"
            src={lion}
            alt=""
            width={1252}
            height={1188}
            initial={{ opacity: 0, y: 24, rotate: -10.55 }}
            animate={{ opacity: 1, y: 0, rotate: -10.55 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          />
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
          <div className="au-col lg-col">{children}</div>
        </main>
      </div>
    </MotionConfig>
  )
}
