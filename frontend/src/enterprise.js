const intro = document.getElementById('enterprise-intro')
const key = 'nexor-public:enterprise-intro:v1'
let seen = false
try { seen = localStorage.getItem(key) === 'seen' } catch { /* Private browsing may restrict storage. */ }
if (!seen && intro) {
  intro.addEventListener('close', () => {
    try { localStorage.setItem(key, 'seen') } catch { /* The notice may then appear on the next visit. */ }
  }, { once: true })
  intro.showModal()
}

if (window.runtime?.BrowserOpenURL) {
  intro?.addEventListener('click', (event) => {
    const link = event.target.closest('a')
    if (!link || !['https://verobots.eu/', 'https://olarian.com/'].includes(link.href)) return
    event.preventDefault()
    window.runtime.BrowserOpenURL(link.href)
  })
}
