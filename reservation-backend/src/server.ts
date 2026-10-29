import 'dotenv/config'
import app from './app.js'
import { reconcileGoogleCalendarDeletions } from './calendar-reconciliation.js'
import { ensureDefaults, prisma } from './prisma.js'

const port = Number(process.env.PORT) || 3000

ensureDefaults().then(() => {
  app.listen(port, () => {
    console.log(`Reservation API listening on http://localhost:${port}`)
    if (!process.env.AUTH_SECRET) console.warn('Using the development auth secret. Set AUTH_SECRET before deployment.')

    const configuredSeconds = Number(process.env.GOOGLE_CALENDAR_SYNC_INTERVAL_SECONDS || 30)
    const intervalSeconds = Number.isFinite(configuredSeconds) ? Math.max(10, configuredSeconds) : 30
    const reconcile = () => {
      void reconcileGoogleCalendarDeletions().then((result) => {
        if (result.cancelled) console.log(`Google Calendar sync cancelled ${result.cancelled} deleted reservation(s).`)
      }).catch((error) => {
        console.error('Google Calendar reverse sync failed:', error instanceof Error ? error.message : error)
      })
    }
    reconcile()
    const timer = setInterval(reconcile, intervalSeconds * 1000)
    timer.unref()
  })
}).catch(async (error) => {
  console.error('Unable to start the API:', error)
  await prisma.$disconnect()
  process.exit(1)
})
