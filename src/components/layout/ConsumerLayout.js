'use client'
import ConsumerNav from './ConsumerNav'
import InstallPrompt from '@/components/InstallPrompt'
import styles from './ConsumerLayout.module.css'

export default function ConsumerLayout({ children, hideNav = false }) {
    return (
        <div className={styles.layout}>
            <main className={`${styles.content} ${hideNav ? '' : styles.withNav}`}>
                {children}
            </main>
            {!hideNav && <ConsumerNav />}
            <InstallPrompt />
        </div>
    )
}
