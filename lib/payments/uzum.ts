export type PaymentMethod = 'humo' | 'uzcard' | 'visa'

interface UzumConfig {
  apiUrl: string
  apiKey: string
  terminalId: string
  siteUrl: string
}

interface UzumRegisterResponse {
  orderId: string
  paymentRedirectUrl: string
}

interface UzumOrderStatusResponse {
  orderId: string
  orderStatus: string
  actionCode?: number
  bindingId?: string
  cardMask?: string
}

function getConfig(): UzumConfig {
  const apiUrl = process.env.UZUM_CHECKOUT_API_URL?.trim()
  const apiKey = process.env.UZUM_CHECKOUT_API_KEY?.trim()
  const terminalId = process.env.UZUM_CHECKOUT_TERMINAL_ID?.trim()
  const siteUrl = process.env.UZUM_CHECKOUT_SITE_URL?.trim()

  if (!apiUrl || !apiKey || !terminalId || !siteUrl) {
    throw new Error('Payment service is not configured yet. Please try again later or contact support.')
  }

  return { apiUrl, apiKey, terminalId, siteUrl }
}

async function callUzum<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getConfig()
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Terminal-Id': config.terminalId,
      'X-API-Key': config.apiKey,
      'Content-Language': 'en',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Payment request failed with ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

function getReturnUrlPath(result: 'success' | 'failure') {
  if (result === 'success') {
    return process.env.UZUM_CHECKOUT_SUCCESS_PATH?.trim() || '/dashboard/subscription?authorization=return'
  }

  return process.env.UZUM_CHECKOUT_FAILURE_PATH?.trim() || '/dashboard/subscription?authorization=failed'
}

export function getVerificationAmount() {
  return {
    amount: Number(process.env.UZUM_CHECKOUT_BIND_AMOUNT_TIYIN ?? '100'),
    currency: 'UZS',
  }
}

export async function startAuthorization(paymentMethod: PaymentMethod, userId: string) {
  const config = getConfig()
  const verification = getVerificationAmount()
  const orderNumber = `sub-${userId.slice(0, 8)}-${Date.now()}`

  const result = await callUzum<UzumRegisterResponse>('/api/v1/payment/register', {
    amount: verification.amount,
    currency: verification.currency,
    operationType: 'BINDING',
    orderNumber,
    successUrl: new URL(getReturnUrlPath('success'), config.siteUrl).toString(),
    failureUrl: new URL(getReturnUrlPath('failure'), config.siteUrl).toString(),
    clientId: userId,
    description: `Starter subscription card binding via ${paymentMethod.toUpperCase()}`,
    viewType: 'REDIRECT',
  })

  return {
    reference: result.orderId,
    redirectUrl: result.paymentRedirectUrl,
    verificationAmount: verification.amount,
    verificationCurrency: verification.currency,
  }
}

export async function getAuthorizationStatus(reference: string) {
  const result = await callUzum<UzumOrderStatusResponse>('/api/v1/payment/status', {
    orderId: reference,
  })

  const status = String(result.orderStatus || '').toUpperCase()
  const maskedPan = String(result.cardMask || '').trim()
  const bindingId = String(result.bindingId || '').trim()
  const actionCode = Number(result.actionCode ?? -1)

  if (bindingId && actionCode === 0) {
    return {
      isAuthorized: true,
      isFailed: false,
      bindingId,
      last4: maskedPan.replace(/\D/g, '').slice(-4),
    }
  }

  if (['FAILED', 'REVERSED', 'DECLINED', 'CANCELED'].includes(status) || (actionCode > 0 && !bindingId)) {
    return {
      isAuthorized: false,
      isFailed: true,
      bindingId: '',
      last4: maskedPan.replace(/\D/g, '').slice(-4),
    }
  }

  return {
    isAuthorized: false,
    isFailed: false,
    bindingId,
    last4: maskedPan.replace(/\D/g, '').slice(-4),
  }
}

export async function unbindCard(bindingId: string) {
  await callUzum('/api/v1/payment/unbind-card', {
    bindingId,
  })
}
