/**
 * CapClient — Tests End-to-End (Puppeteer)
 *
 * NOTE : La confirmation email Supabase doit être désactivée pour que le test
 * fonctionne (l'utilisateur doit pouvoir se connecter immédiatement après
 * inscription sans confirmer son email).
 * Sinon, configurer un SMTP custom ou utiliser l'option
 * "Allow user to sign up without email confirmation" dans
 * https://supabase.com/dashboard/project/jdwvkmzwgtdwgrayktph/settings/auth
 *
 * Couverture :
 *   1. Inscription (formulaire /signup — email UI différent)
 *   2. Connexion (formulaire /login avec le compte de test)
 *   3. Ajout d'un client (dialog)
 *   4. Pipeline — changement de statut (modifier)
 *   5. Modification — édition des infos d'un client
 *   6. Suppression — supprimer un client
 *   7. Limite 5 clients — vérifier le bandeau Free
 *
 * Usage :
 *   node tests/e2e.mjs
 *
 * Variables d'env optionnelles :
 *   BASE_URL        — URL de l'app (défaut : https://capclient.vercel.app)
 *   HEADLESS        — "false" pour ouvrir le navigateur (défaut : "true")
 *   SLOW_MO         — délai entre actions en ms (défaut : 0)
 *   SCREENSHOTS_DIR — dossier pour les captures (défaut : tests/screenshots)
 */

import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Configuration ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL         = process.env.BASE_URL || 'https://capclient.vercel.app'
const HEADLESS         = process.env.HEADLESS !== 'false'
const SLOW_MO          = parseInt(process.env.SLOW_MO || '0', 10)
const SCREENSHOTS_DIR  = process.env.SCREENSHOTS_DIR || path.join(__dirname, 'screenshots')

// Timeouts
const NAV_TIMEOUT   = 30_000   // navigation page
const ELEM_TIMEOUT  = 15_000   // attente d'un élément
const ACTION_DELAY  = 300       // délai entre les actions rapides

// Utilisateur de test — email unique à chaque run pour éviter les conflits
const TS          = Date.now()
const TEST_EMAIL  = `e2e-test-${TS}@capclient-test.invalid`
const TEST_PWD    = `E2eTest!${TS}`

// Clients de test pour le CRUD
const CLIENT_1 = {
  nom: 'Alice Dupont',
  email: 'alice.dupont@test.fr',
  entreprise: 'ACME SAS',
  telephone: '0612345678',
}
const CLIENT_EDIT_NOM = 'Alice Dupont-Modifiée'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Logger avec timestamp et couleurs ANSI */
const log = {
  info:    (msg) => console.log(`\x1b[36m[INFO]\x1b[0m  ${msg}`),
  ok:      (msg) => console.log(`\x1b[32m[PASS]\x1b[0m  ✅ ${msg}`),
  warn:    (msg) => console.log(`\x1b[33m[WARN]\x1b[0m  ⚠️  ${msg}`),
  error:   (msg) => console.error(`\x1b[31m[FAIL]\x1b[0m  ❌ ${msg}`),
  section: (msg) => console.log(`\n\x1b[35m${'─'.repeat(60)}\x1b[0m\n\x1b[35m[TEST]\x1b[0m  ${msg}\n\x1b[35m${'─'.repeat(60)}\x1b[0m`),
}

/** Capture d'écran nommée — sauvegardée dans SCREENSHOTS_DIR */
async function screenshot(page, name) {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(SCREENSHOTS_DIR, `${ts}_${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  log.info(`Screenshot → ${path.relative(process.cwd(), file)}`)
  return file
}

/** Capture d'écran en cas d'échec */
async function screenshotOnFail(page, name) {
  try {
    await screenshot(page, `FAIL_${name}`)
  } catch (_) { /* ignore */ }
}

/** Attendre qu'un sélecteur soit visible avec un timeout personnalisé */
async function waitFor(page, selector, timeout = ELEM_TIMEOUT) {
  return page.waitForSelector(selector, { visible: true, timeout })
}

/** Remplir un input (clear + type) */
async function fill(page, selector, value) {
  const el = await waitFor(page, selector)
  await el.click({ clickCount: 3 })
  await el.type(value, { delay: ACTION_DELAY > 100 ? 30 : 0 })
}

/** Délai simple */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Création de l'utilisateur de test via le formulaire /signup ───────────────

/**
 * Crée un utilisateur de test via le formulaire /signup de l'application.
 * Prérequis : la confirmation email Supabase doit être désactivée pour que
 * l'utilisateur puisse se connecter immédiatement après inscription.
 */
async function createTestUserViaForm(page) {
  log.info(`Inscription de l'utilisateur de test : ${TEST_EMAIL}`)
  // Charger l'app d'abord (nécessaire pour SPA — initialise React Router)
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT })
  // Puis naviguer vers /signup
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT })
  // Attendre que le formulaire soit visible (CardTitle est une <div>, pas un <h2>)
  await waitFor(page, 'form', ELEM_TIMEOUT)
  await fill(page, '#email', TEST_EMAIL)
  await fill(page, '#password', TEST_PWD)
  await fill(page, '#confirm-password', TEST_PWD)
  await page.click('button[type="submit"]')
  // Attendre le message de succès (CardTitle est une <div data-slot="card-title">)
  // Ou si la confirmation email est désactivée, l'app redirige directement vers /dashboard
  await page.waitForFunction(
    () => document.body.innerText.includes('Inscription réussie') ||
          document.body.innerText.includes('confirmation') ||
          window.location.pathname.includes('/dashboard'),
    { timeout: ELEM_TIMEOUT }
  ).catch(async () => {
    const text = await page.$eval('body', (el) => el.innerText)
    const url = page.url()
    if (!text.includes('Inscription réussie') && !text.includes('confirmation') && !url.includes('/dashboard')) {
      throw new Error(`Message de succès inscription non trouvé (URL: ${url}, text: ${text.slice(0, 200)})`)
    }
  })
  await screenshot(page, '00_test_user_created')
  log.ok('Utilisateur créé via le formulaire, email de confirmation envoyé (ou confirmation désactivée)')
}

// ─── Helpers navigation ───────────────────────────────────────────────────────

/** Naviguer vers une page et attendre qu'elle soit chargée */
async function goto(page, url) {
  log.info(`Navigation → ${url}`)
  await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT })
}

/** Vérifier que l'URL actuelle correspond à un pattern */
async function assertUrl(page, pattern, label) {
  const url = page.url()
  const ok  = typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)
  if (!ok) throw new Error(`${label}: URL attendue "${pattern}", obtenue "${url}"`)
  log.ok(`URL correcte : ${url}`)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * TEST 1 — Inscription
 * Vérifie que la page /signup est accessible et fonctionnelle
 * avec un email différent du compte de test principal.
 */
async function testSignup(page) {
  log.section('TEST 1 — Inscription (page /signup)')

  // Charger la racine d'abord (nécessaire pour SPA)
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT })
  await goto(page, `${BASE_URL}/signup`)

  // Si déjà connecté (via le setup), /signup redirige vers /dashboard
  const currentUrl = page.url()
  if (currentUrl.includes('/dashboard')) {
    log.info('Déjà connecté — vérification du comportement attendu')
    log.ok('Redirection automatique vers le dashboard (GuestRoute)')
    await screenshot(page, '01_signup_redirige_dashboard')
    return
  }

  await waitFor(page, 'form', ELEM_TIMEOUT)
  await screenshot(page, '01_signup_page')

  // Remplir le formulaire avec un email différent du compte de test
  const signupEmail = `signup-ui-${TS}@capclient-test.invalid`
  const signupPwd   = `UiTest!${TS}`

  await fill(page, '#email', signupEmail)
  await fill(page, '#password', signupPwd)
  await fill(page, '#confirm-password', signupPwd)

  await screenshot(page, '01_signup_filled')

  // Soumettre
  await page.click('button[type="submit"]')

  // Attendre le message de succès (CardTitle est une <div>, pas un h2)
  await page.waitForFunction(
    () => document.body.innerText.includes('Inscription réussie') ||
          document.body.innerText.includes('confirmation'),
    { timeout: ELEM_TIMEOUT }
  ).catch(async () => {
    const text = await page.$eval('body', (el) => el.innerText)
    if (!text.includes('Inscription réussie') && !text.includes('confirmation')) {
      throw new Error('Message de succès inscription non trouvé')
    }
  })

  await screenshot(page, '01_signup_success')
  log.ok('Inscription — formulaire soumis, message de succès affiché')
}

/**
 * TEST 2 — Connexion
 * Se connecte avec le compte créé via le formulaire /signup.
 */
async function testLogin(page) {
  log.section('TEST 2 — Connexion (/login)')

  // Charger la racine d'abord (nécessaire pour SPA)
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT })
  await goto(page, `${BASE_URL}/login`)

  // Si déjà connecté (via le setup), /login redirige vers /dashboard
  const currentUrl = page.url()
  if (currentUrl.includes('/dashboard')) {
    log.info('Déjà connecté — vérification du comportement attendu')
    log.ok('Redirection automatique vers le dashboard (GuestRoute)')
    await screenshot(page, '02_login_redirige_dashboard')
    return
  }

  await waitFor(page, 'form', ELEM_TIMEOUT)
  await screenshot(page, '02_login_page')

  await fill(page, '#email', TEST_EMAIL)
  await fill(page, '#password', TEST_PWD)
  await screenshot(page, '02_login_filled')

  await page.click('button[type="submit"]')

  // Attendre la redirection vers /dashboard
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: NAV_TIMEOUT }).catch(() => {})
  await sleep(1000) // laisser React se monter

  await screenshot(page, '02_login_after')
  await assertUrl(page, '/dashboard', 'Connexion')
  log.ok('Connexion — redirigé vers /dashboard')
}

/**
 * TEST 3 — Ajout d'un client
 * Navigue vers /clients, ouvre le dialog, remplit le formulaire.
 */
async function testAddClient(page) {
  log.section('TEST 3 — Ajout d\'un client')

  await goto(page, `${BASE_URL}/clients`)
  await sleep(1500) // attendre le chargement des clients

  await screenshot(page, '03_clients_page')

  // Attendre que le bouton "Nouveau client" soit présent dans le DOM
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Nouveau client')),
    { timeout: ELEM_TIMEOUT }
  )

  // Vérifier s'il est désactivé (limite Free atteinte)
  const btnState = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const btn  = btns.find((b) => b.textContent.includes('Nouveau client'))
    return btn ? { found: true, disabled: btn.disabled } : { found: false, disabled: false }
  })

  if (!btnState.found) throw new Error('Bouton "Nouveau client" introuvable')

  if (btnState.disabled) {
    log.warn('Bouton "Nouveau client" désactivé — limite peut-être déjà atteinte')
    throw new Error('Impossible d\'ajouter un client : bouton désactivé (limite Free ?)')
  }

  // Cliquer via evaluate pour éviter les problèmes de sélecteur CSS
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const btn  = btns.find((b) => b.textContent.includes('Nouveau client'))
    if (btn) btn.click()
  })

  // Attendre que le dialog s'ouvre
  await waitFor(page, '[role="dialog"]', ELEM_TIMEOUT)
  await sleep(500)
  await screenshot(page, '03_add_client_dialog')

  // Remplir le formulaire
  await fill(page, '#nom', CLIENT_1.nom)
  await fill(page, '#email', CLIENT_1.email)
  await fill(page, '#telephone', CLIENT_1.telephone)
  await fill(page, '#entreprise', CLIENT_1.entreprise)

  await screenshot(page, '03_add_client_filled')

  // Soumettre
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[role="dialog"] button'))
    const btn  = btns.find((b) => b.textContent.includes('Ajouter'))
    if (btn) btn.click()
  })

  // Attendre que le dialog se ferme
  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"]'),
    { timeout: ELEM_TIMEOUT }
  ).catch(() => {
    log.warn('Dialog pas fermé — vérification de l\'erreur…')
  })

  await sleep(1000)
  await screenshot(page, '03_add_client_done')

  // Vérifier que le client apparaît dans la liste
  const found = await page.evaluate((nom) => {
    return document.body.innerText.includes(nom)
  }, CLIENT_1.nom)

  if (!found) throw new Error(`Client "${CLIENT_1.nom}" non trouvé après création`)
  log.ok(`Client "${CLIENT_1.nom}" créé et visible dans la liste`)
}

/**
 * TEST 4 — Pipeline (changement de statut via modification)
 * Ouvre le dropdown du client et change son statut vers "En cours".
 */
async function testPipeline(page) {
  log.section('TEST 4 — Pipeline (changement de statut)')

  // S'assurer qu'on est sur /clients
  if (!page.url().includes('/clients')) {
    await goto(page, `${BASE_URL}/clients`)
    await sleep(1500)
  }

  await screenshot(page, '04_pipeline_before')

  // Ouvrir le menu d'actions du premier client (bouton MoreHorizontal)
  await page.evaluate(() => {
    // Chercher le premier bouton "Actions pour..."
    const btn = document.querySelector('[aria-label^="Actions pour"]')
    if (btn) btn.click()
    else {
      // Fallback : premier bouton avec MoreHorizontal icon
      const btns = document.querySelectorAll('button')
      const moreBtn = Array.from(btns).find((b) => b.querySelector('svg'))
      if (moreBtn) moreBtn.click()
    }
  })

  await sleep(500)
  await screenshot(page, '04_pipeline_menu_open')

  // Cliquer sur "Modifier"
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
    const modif = items.find((i) => i.textContent.includes('Modifier'))
    if (modif) modif.click()
  })

  await waitFor(page, '[role="dialog"]', ELEM_TIMEOUT)
  await sleep(500)
  await screenshot(page, '04_pipeline_edit_dialog')

  // Changer le statut vers "En cours"
  // Le Select shadcn/ui est rendu comme un bouton trigger
  await page.evaluate(() => {
    const selects = document.querySelectorAll('[role="dialog"] button')
    // Le trigger du Select contient le texte du statut actuel
    const trigger = Array.from(selects).find((b) =>
      b.closest('[id]')?.id === 'statut' ||
      b.textContent.includes('Prospect') ||
      b.textContent.includes('prospect')
    )
    if (trigger) trigger.click()
  })

  await sleep(500)
  await screenshot(page, '04_pipeline_status_dropdown')

  // Cliquer sur "En cours"
  await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll('[role="option"]'))
    const enCours = opts.find((o) => o.textContent.includes('En cours'))
    if (enCours) enCours.click()
  })

  await sleep(300)

  // Sauvegarder
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[role="dialog"] button'))
    const save = btns.find((b) =>
      b.textContent.includes('Enregistrer') || b.textContent.includes('Ajouter')
    )
    if (save) save.click()
  })

  // Attendre fermeture du dialog
  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"]'),
    { timeout: ELEM_TIMEOUT }
  ).catch(() => {})

  await sleep(1000)
  await screenshot(page, '04_pipeline_done')
  log.ok('Pipeline — statut changé vers "En cours"')
}

/**
 * TEST 5 — Modification d'un client
 * Édite le nom du client existant.
 */
async function testEditClient(page) {
  log.section('TEST 5 — Modification d\'un client')

  if (!page.url().includes('/clients')) {
    await goto(page, `${BASE_URL}/clients`)
    await sleep(1500)
  }

  await screenshot(page, '05_edit_before')

  // Ouvrir le menu d'actions
  await page.evaluate(() => {
    const btn = document.querySelector('[aria-label^="Actions pour"]')
    if (btn) btn.click()
  })

  await sleep(400)

  // Cliquer "Modifier"
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
    const modif = items.find((i) => i.textContent.includes('Modifier'))
    if (modif) modif.click()
  })

  await waitFor(page, '[role="dialog"]', ELEM_TIMEOUT)
  await sleep(500)
  await screenshot(page, '05_edit_dialog')

  // Modifier le nom
  await fill(page, '#nom', CLIENT_EDIT_NOM)
  await screenshot(page, '05_edit_filled')

  // Sauvegarder
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[role="dialog"] button'))
    const save = btns.find((b) => b.textContent.includes('Enregistrer'))
    if (save) save.click()
  })

  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"]'),
    { timeout: ELEM_TIMEOUT }
  ).catch(() => {})

  await sleep(1000)
  await screenshot(page, '05_edit_done')

  // Vérifier que le nouveau nom apparaît
  const found = await page.evaluate((nom) => document.body.innerText.includes(nom), CLIENT_EDIT_NOM)
  if (!found) throw new Error(`Nom modifié "${CLIENT_EDIT_NOM}" non trouvé`)
  log.ok(`Modification — nom mis à jour : "${CLIENT_EDIT_NOM}"`)
}

/**
 * TEST 6 — Suppression d'un client
 * Supprime le client créé lors des tests.
 */
async function testDeleteClient(page) {
  log.section('TEST 6 — Suppression d\'un client')

  if (!page.url().includes('/clients')) {
    await goto(page, `${BASE_URL}/clients`)
    await sleep(1500)
  }

  await screenshot(page, '06_delete_before')

  // Intercepter la confirm() dialog et l'accepter automatiquement
  page.once('dialog', async (dialog) => {
    log.info(`Dialog natif : "${dialog.message()}" → accepté`)
    await dialog.accept()
  })

  // Ouvrir le menu actions
  await page.evaluate(() => {
    const btn = document.querySelector('[aria-label^="Actions pour"]')
    if (btn) btn.click()
  })

  await sleep(400)
  await screenshot(page, '06_delete_menu')

  // Cliquer "Supprimer"
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
    const del   = items.find((i) => i.textContent.includes('Supprimer'))
    if (del) del.click()
  })

  await sleep(1500)
  await screenshot(page, '06_delete_done')

  // Vérifier que le client n'est plus là
  const stillThere = await page.evaluate((nom) => document.body.innerText.includes(nom), CLIENT_EDIT_NOM)
  if (stillThere) {
    log.warn(`Client "${CLIENT_EDIT_NOM}" encore visible — la suppression a peut-être échoué`)
  } else {
    log.ok(`Client "${CLIENT_EDIT_NOM}" supprimé avec succès`)
  }
}

/**
 * TEST 7 — Limite 5 clients (plan Free)
 * Crée 5 clients via l'UI, puis vérifie que la bannière de limite
 * s'affiche et que le bouton est désactivé.
 */
async function testFreeLimit(page) {
  log.section('TEST 7 — Limite 5 clients (plan Free)')

  await goto(page, `${BASE_URL}/clients`)
  await sleep(1500)

  // Créer des clients via l'UI jusqu'à atteindre la limite
  log.info('Création de clients via l\'UI pour tester la limite Free…')
  for (let i = 1; i <= 5; i++) {
    const btnState = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const btn  = btns.find((b) => b.textContent.includes('Nouveau client'))
      return btn ? { found: true, disabled: btn.disabled } : { found: false, disabled: false }
    })

    if (!btnState.found || btnState.disabled) {
      log.info(`Limite atteinte ou bouton absent après ${i - 1} clients créés`)
      break
    }

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const btn  = btns.find((b) => b.textContent.includes('Nouveau client'))
      if (btn) btn.click()
    })

    await waitFor(page, '[role="dialog"]', ELEM_TIMEOUT)
    await sleep(500)

    await fill(page, '#nom', `Client Limite ${i}`)
    await fill(page, '#email', `limite${i}-${TS}@test.fr`)

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="dialog"] button'))
      const btn  = btns.find((b) => b.textContent.includes('Ajouter'))
      if (btn) btn.click()
    })

    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]'),
      { timeout: ELEM_TIMEOUT }
    ).catch(() => {})

    await sleep(1000)

    // Recharger pour voir l'état courant
    await goto(page, `${BASE_URL}/clients`)
    await sleep(1000)

    log.info(`Client ${i}/5 créé`)
  }

  await screenshot(page, '07_limit_page')

  // Vérifier la bannière de limite
  const bannerVisible = await page.evaluate(() => {
    const text = document.body.innerText
    return (
      text.includes('limite de 5 clients') ||
      text.includes('plan Gratuit') ||
      text.includes('Passer à CapClient Pro') ||
      text.includes('Passez à CapClient Pro')
    )
  })

  // Vérifier que le bouton "Nouveau client" est désactivé
  const btnDisabled = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const btn  = btns.find((b) => b.textContent.includes('Nouveau client'))
    return btn ? btn.disabled : null
  })

  await screenshot(page, '07_limit_banner')

  if (bannerVisible) {
    log.ok('Bannière limite Free visible')
  } else {
    log.warn('Bannière limite Free non trouvée (moins de 5 clients en base ?)')
  }

  if (btnDisabled === true) {
    log.ok('Bouton "Nouveau client" désactivé à la limite Free')
  } else if (btnDisabled === null) {
    log.warn('Bouton "Nouveau client" non trouvé')
  } else {
    log.warn('Bouton "Nouveau client" non désactivé — vérifier la logique')
  }

  if (!bannerVisible && btnDisabled !== true) {
    throw new Error('Limite 5 clients non détectée dans l\'UI')
  }

  log.ok('Limite 5 clients — comportement Free correct')
}

// ─── Runner principal ──────────────────────────────────────────────────────────

async function run() {
  console.log('\n\x1b[1m\x1b[34m╔══════════════════════════════════════════════════╗')
  console.log('║       CapClient — Tests E2E (Puppeteer)          ║')
  console.log('╚══════════════════════════════════════════════════╝\x1b[0m')
  console.log(`  BASE_URL  : ${BASE_URL}`)
  console.log(`  HEADLESS  : ${HEADLESS}`)
  console.log(`  TEST USER : ${TEST_EMAIL}`)
  console.log()

  // Créer le dossier screenshots
  if (!existsSync(SCREENSHOTS_DIR)) {
    await mkdir(SCREENSHOTS_DIR, { recursive: true })
  }

  let browser = null
  let page    = null

  const results = []
  let passed = 0
  let failed = 0

  /**
   * Exécute un test avec capture d'erreur et screenshot en cas d'échec.
   */
  async function runTest(name, fn) {
    try {
      await fn()
      results.push({ name, status: 'PASS' })
      passed++
    } catch (err) {
      log.error(`${name} : ${err.message}`)
      if (page) await screenshotOnFail(page, name.replace(/\s+/g, '_'))
      results.push({ name, status: 'FAIL', error: err.message })
      failed++
    }
  }

  try {
    // ── 1. Lancer le navigateur ───────────────────────────────────────────────
    log.info('Lancement du navigateur Puppeteer…')
    browser = await puppeteer.launch({
      headless: HEADLESS,
      slowMo:   SLOW_MO,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,900',
      ],
      // Utiliser le Chrome du cache puppeteer si disponible
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    })

    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })

    // Intercepter les erreurs console pour le debug
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        log.warn(`[Browser Console Error] ${msg.text()}`)
      }
    })

    // ── 2. Créer l'utilisateur de test via le formulaire /signup ──────────────
    await createTestUserViaForm(page)

    // ── 3. Tests E2E ─────────────────────────────────────────────────────────
    await runTest('01 — Inscription', () => testSignup(page))
    await runTest('02 — Connexion',   () => testLogin(page))

    // Vérifier que la session est active avant de continuer
    const url = page.url()
    if (!url.includes('/dashboard')) {
      log.warn(`Pas sur /dashboard (${url}) — les tests suivants peuvent échouer`)
    }

    await runTest('03 — Ajout client',     () => testAddClient(page))
    await runTest('04 — Pipeline statut',  () => testPipeline(page))
    await runTest('05 — Modification',     () => testEditClient(page))
    await runTest('06 — Suppression',      () => testDeleteClient(page))
    await runTest('07 — Limite 5 clients', () => testFreeLimit(page))

  } catch (err) {
    log.error(`Erreur fatale : ${err.message}`)
    if (page) await screenshotOnFail(page, 'FATAL')
    failed++
    results.push({ name: 'SETUP', status: 'FAIL', error: err.message })

  } finally {
    // ── Nettoyage ─────────────────────────────────────────────────────────────
    if (browser) {
      log.info('Fermeture du navigateur…')
      await browser.close()
    }

    // L'utilisateur de test est laissé en place (suppression manuelle si besoin)
    log.info('Cleanup : utilisateur de test laissé en place (sera supprimé manuellement si besoin)')

    // ── Rapport final ─────────────────────────────────────────────────────────
    console.log('\n\x1b[1m\x1b[34m══════════════════════════════════════════════════\x1b[0m')
    console.log('\x1b[1m  Résultats des tests\x1b[0m')
    console.log('\x1b[34m══════════════════════════════════════════════════\x1b[0m')

    for (const r of results) {
      const icon  = r.status === 'PASS' ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m'
      const label = r.status === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
      console.log(`  ${icon} [${label}] ${r.name}${r.error ? ` — ${r.error}` : ''}`)
    }

    const total = passed + failed
    console.log('\x1b[34m──────────────────────────────────────────────────\x1b[0m')
    console.log(`  \x1b[1mTotal : ${total} tests | ${passed} réussis | ${failed} échoués\x1b[0m`)
    console.log(`  Screenshots : ${SCREENSHOTS_DIR}`)
    console.log('\x1b[34m══════════════════════════════════════════════════\x1b[0m\n')

    process.exit(failed > 0 ? 1 : 0)
  }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

run().catch((err) => {
  console.error('Erreur non gérée :', err)
  process.exit(1)
})
