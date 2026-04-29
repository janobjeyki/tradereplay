import { createHash } from 'crypto'

export type CardNetwork = 'humo' | 'uzcard'

interface ClickConfig {
  apiUrl: string
  serviceId: string
  merchantUserId: string
  secretKey: string
  subscriptionAmount: number
}

interface ClickResponse {
  error_code?: number | string
  error_note?: string
  card_token?: string
  phone_number?: string
  card_number?: string
  payment_id?: string | number
  payment_status?: string | number
}

function getConfig(): ClickConfig {
  const apiUrl = process.env.CLICK_API_URL?.trim() || 'https://api.click.uz/v2/merchant'
  const serviceId = process.env.CLICK_SERVICE_ID?.trim()
  const merchantUserId = process.env.CLICK_MERCHANT_USER_ID?.trim()
  const secretKey = process.env.CLICK_SECRET_KEY?.trim()
  const subscriptionAmount = Number(process.env.CLICK_SUBSCRIPTION_AMOUNT_UZS || 0)

  if (!serviceId || !merchantUserId || !secretKey) {
    throw new Error('Missing Click configuration. Set CLICK_SERVICE_ID, CLICK_MERCHANT_USER_ID, and CLICK_SECRET_KEY.')
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    serviceId,
    merchantUserId,
    secretKey,
    subscriptionAmount: Number.isFinite(subscriptionAmount) ? subscriptionAmount : 0,
  }
}

function authHeader(config: ClickConfig) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const digest = createHash('sha1').update(`${timestamp}${config.secretKey}`).digest('hex')
  return `${config.merchantUserId}:${digest}:${timestamp}`
}

async function callClick(path: string, init: RequestInit = {}) {
  const config = getConfig()
  const response = await fetch(`${config.apiUrl}/${path.replace(/^\/+/, '')}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Auth: authHeader(config),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as ClickResponse | null
  if (!response.ok) {
    throw new Error(`Click request failed with ${response.status}`)
  }

  if (!payload) {
    throw new Error('Click returned an empty response.')
  }

  if (Number(payload.error_code) !== 0) {
    throw new Error(payload.error_note || 'Click request failed.')
  }

  return payload
}

function normalizeCardNumber(raw: string) {
  return raw.replace(/\D/g, '')
}

function normalizeCardExpire(raw: string) {
  return raw.replace(/\D/g, '')
}

function parseCardExpire(expire: string) {
  const digits = normalizeCardExpire(expire)
  if (digits.length !== 4) {
    return { month: null, year: null }
  }

  const month = Number(digits.slice(0, 2))
  const year = Number(`20${digits.slice(2)}`)
  return { month, year }
}

export function getSubscriptionAmount() {
  const subscriptionAmount = Number(process.env.CLICK_SUBSCRIPTION_AMOUNT_UZS || 0)
  return Number.isFinite(subscriptionAmount) ? subscriptionAmount : 0
}

export function validateCardInput(cardNumber: string, cardExpire: string, cardNetwork: CardNetwork) {
  const normalizedNumber = normalizeCardNumber(cardNumber)
  const normalizedExpire = normalizeCardExpire(cardExpire)

  if (normalizedNumber.length !== 16) {
    throw new Error('Card number must contain 16 digits.')
  }

  if (normalizedExpire.length !== 4) {
    throw new Error('Card expiry must be in MM/YY format.')
  }

  const month = Number(normalizedExpire.slice(0, 2))
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Card expiry month is invalid.')
  }

  if (cardNetwork === 'humo' && !normalizedNumber.startsWith('9860')) {
    throw new Error('HUMO cards should start with 9860.')
  }

  if (cardNetwork === 'uzcard' && !normalizedNumber.startsWith('8600')) {
    throw new Error('Uzcard cards should start with 8600.')
  }

  return {
    number: normalizedNumber,
    expire: normalizedExpire,
    last4: normalizedNumber.slice(-4),
    ...parseCardExpire(normalizedExpire),
  }
}

export async function startAuthorization(cardNetwork: CardNetwork, cardNumber: string, cardExpire: string) {
  const config = getConfig()
  const normalized = validateCardInput(cardNumber, cardExpire, cardNetwork)
  const payload = await callClick('card_token/request', {
    method: 'POST',
    body: JSON.stringify({
      service_id: config.serviceId,
      card_number: normalized.number,
      expire_date: normalized.expire,
      temporary: 0,
    }),
  })

  const token = String(payload.card_token || '').trim()
  if (!token) {
    throw new Error('Click did not return a card token.')
  }

  return {
    reference: token,
    verificationAmount: config.subscriptionAmount,
    verificationCurrency: 'UZS',
    verificationPhone: String(payload.phone_number || '').trim(),
    verificationWaitMs: 0,
    last4: normalized.last4,
    cardExpMonth: normalized.month,
    cardExpYear: normalized.year,
  }
}

export async function verifyAuthorization(reference: string, code: string) {
  const config = getConfig()
  const normalizedCode = code.replace(/\D/g, '')
  if (normalizedCode.length < 4) {
    throw new Error('Verification code is too short.')
  }

  const payload = await callClick('card_token/verify', {
    method: 'POST',
    body: JSON.stringify({
      service_id: config.serviceId,
      card_token: reference,
      sms_code: normalizedCode,
    }),
  })

  const cardNumber = String(payload.card_number || '').replace(/\D/g, '')
  return {
    bindingId: reference,
    token: reference,
    last4: cardNumber.slice(-4),
  }
}

export async function chargeSubscription(reference: string, merchantTransactionId: string, amount = getSubscriptionAmount()) {
  if (amount <= 0) {
    return { paymentId: null }
  }

  const config = getConfig()
  const payload = await callClick('card_token/payment', {
    method: 'POST',
    body: JSON.stringify({
      service_id: config.serviceId,
      card_token: reference,
      amount,
      transaction_parameter: merchantTransactionId,
    }),
  })

  const paymentStatus = Number(payload.payment_status ?? 1)
  if (!Number.isFinite(paymentStatus) || paymentStatus < 1) {
    throw new Error('Click payment was not completed.')
  }

  return {
    paymentId: payload.payment_id ? String(payload.payment_id) : null,
  }
}

export async function deleteCardToken(token: string) {
  const config = getConfig()
  await callClick(`card_token/${config.serviceId}/${encodeURIComponent(token)}`, {
    method: 'DELETE',
  })
}
