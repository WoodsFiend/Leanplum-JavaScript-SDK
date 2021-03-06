import Constants from '../../src/Constants'
import PushManager from '../../src/PushManager'

describe(PushManager, () => {
  let pushManager: PushManager
  let windowMock: jest.SpyInstance<Window & typeof globalThis, []>
  const createRequestSpy: jest.Mock<() => void> = jest.fn()

  beforeEach(() => {
    pushManager = new PushManager(createRequestSpy)
    windowMock = jest.spyOn(globalThis, 'window', 'get')
  })

  afterEach(() => {
    windowMock.mockReset()
    localStorage.clear()
    jest.clearAllMocks()
  })

  describe('isWebPushSupported', () => {
    it('returns `false` when navigator is undefined', () => {
      windowMock.mockReturnValue({ PushManager: {} } as any)

      expect(pushManager.isWebPushSupported()).toBeFalsy()
    })

    it('returns `false` when serviceWorker is undefined', () => {
      windowMock.mockReturnValue({ navigator: {}, PushManager: {} } as any)

      expect(pushManager.isWebPushSupported()).toBeFalsy()
    })

    it('returns `false` when PushManager is undefined', () => {
      windowMock.mockReturnValue({ navigator: { serviceWorker: {} } } as any)

      expect(pushManager.isWebPushSupported()).toBeFalsy()
    })

    it('returns `true` when supported', () => {
      mockServiceWorker({})

      expect(pushManager.isWebPushSupported()).toBeTruthy()
    })
  })

  describe('isWebPushSubscribed', () => {
    it('returns `false` when Web Push is not supported', async () => {
      windowMock.mockReturnValue({} as any)

      expect(await pushManager.isWebPushSubscribed()).toBeFalsy()
    })

    it('returns `false` with no registration', async () => {
      mockServiceWorker({
        getRegistration: () => null
      })

      expect(await pushManager.isWebPushSubscribed()).toBeFalsy()
    })

    it('returns `false` with no subscription', async () => {
      mockServiceWorker({
        getRegistration: () => ({
          pushManager: {
            getSubscription: () => null
          }
        })
      })

      expect(await pushManager.isWebPushSubscribed()).toBeFalsy()
    })

    it('returns `true` when there is subscription', async () => {
      mockServiceWorker({
        getRegistration: () => ({
          pushManager: {
            getSubscription: () => ({
              endpoint: 'test'
            })
          }
        })
      })

      expect(await pushManager.isWebPushSubscribed()).toBeTruthy()
      expect(createRequestSpy).toHaveBeenCalledTimes(1)
    })

    it('updates subscription on server with new subscription', async () => {
      let subscription: any = null
      const registration = {
        pushManager: {
          getSubscription: () => subscription,
          subscribe: () => subscription
        }
      }

      mockServiceWorker({
        getRegistration: () => registration,
        register: () => registration
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      subscription = {
        endpoint: 'old_subscription'
      }

      await pushManager.subscribeUser()

      subscription = {
        endpoint: 'new_subscription'
      }

      await pushManager.isWebPushSubscribed()

      expect(createRequestSpy).toHaveBeenCalledTimes(2)

      const [action, args, options] = createRequestSpy.mock.calls[1];

      expect(action).toEqual(Constants.METHODS.SET_DEVICE_ATTRIBUTES)
      expect(args.buildDict()).toEqual({
        [Constants.PARAMS.WEB_PUSH_SUBSCRIPTION]: JSON.stringify({
          endpoint: 'new_subscription',
          key: '',
          auth: ''
        })
      })
      expect(options).toEqual({
        queued: false,
        sendNow: true
      })
    })
  })

  describe('register', () => {
    it('calls callback with `false` when Web Push is not supported', async () => {
      const callback = jest.fn()
      windowMock.mockReturnValue({} as any)

      jest.spyOn(console, 'log').mockImplementationOnce(() => {})
      await pushManager.register('', null, callback)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(false)
    })

    it('calls callback with `false` when there is an error', async () => {
      const callback = jest.fn()
      mockServiceWorker({
        register: () => ({
          pushManager: null // cause an exception
        })
      })

      jest.spyOn(console, 'log').mockImplementationOnce(() => {})
      await pushManager.register('', null, callback)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(false)
    })

    it('calls callback with `false` when not subscribed', async () => {
      const callback = jest.fn()
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null
          }
        })
      })

      await pushManager.register('', null, callback)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(false)
    })

    it('calls callback with `true` when subscribed', async () => {
      const callback = jest.fn()
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => ({
              endpoint: 'test'
            })
          }
        })
      })

      await pushManager.register('', null, callback)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(true)
    })

    it('uses default SW URL when empty provided', async () => {
      const callback = jest.fn()
      const register = jest.fn().mockReturnValue({
        pushManager: {
          getSubscription: () => null
        }
      })
      mockServiceWorker({ register })

      await pushManager.register('', null, callback)

      expect(register).toHaveBeenCalledTimes(1)
      expect(register).toHaveBeenCalledWith('/sw.min.js', null)
    })

    it('does not update subscription on server when not subscribed', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      expect(createRequestSpy).toHaveBeenCalledTimes(0)
    })

    it('updates subscription on server when subscribed', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => ({
              endpoint: 'test',
              getKey: (name: string) => name.split('').map((x) => x.charCodeAt(0))
            })
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      expect(createRequestSpy).toHaveBeenCalledTimes(1)

      const [action, args, options] = createRequestSpy.mock.calls[0];

      expect(action).toEqual(Constants.METHODS.SET_DEVICE_ATTRIBUTES)
      expect(args.buildDict()).toEqual({
        [Constants.PARAMS.WEB_PUSH_SUBSCRIPTION]: JSON.stringify({
          endpoint: 'test',
          key: 'cDI1NmRo',
          auth: 'YXV0aA=='
        })
      })
      expect(options).toEqual({
        queued: false,
        sendNow: true
      })
    })
  })

  describe('subscribeUser', () => {
    it('throws error when error occurs', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null,
            subscribe: undefined // cause an exception
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      await expect(pushManager.subscribeUser()).rejects.toThrowError()
    })

    it('throws error when not subscribed', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null,
            subscribe: () => null
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      await expect(pushManager.subscribeUser()).rejects.toThrowError()
    })

    it('returns `true` on success', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null,
            subscribe: () => ({
              endpoint: 'test'
            })
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      expect(await pushManager.subscribeUser()).toBe(true)
    })

    it('does not update subscription on server when not subscribed', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null,
            subscribe: () => null
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))
      await pushManager.subscribeUser().catch(() => { /* noop - expected */ })

      expect(createRequestSpy).toHaveBeenCalledTimes(0)
    })

    it('updates subscription on server when subscribed', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null,
            subscribe: () => ({
              endpoint: 'test',
              getKey: (name: string) => name.split('').map((x) => x.charCodeAt(0))
            })
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))
      await pushManager.subscribeUser()

      expect(createRequestSpy).toHaveBeenCalledTimes(1)

      const [action, args, options] = createRequestSpy.mock.calls[0];

      expect(action).toEqual(Constants.METHODS.SET_DEVICE_ATTRIBUTES)
      expect(args.buildDict()).toEqual({
        [Constants.PARAMS.WEB_PUSH_SUBSCRIPTION]: JSON.stringify({
          endpoint: 'test',
          key: 'cDI1NmRo',
          auth: 'YXV0aA=='
        })
      })
      expect(options).toEqual({
        queued: false,
        sendNow: true
      })
    })
  })

  describe('unsubscribeUser', () => {
    it('throws error when error occurs', async () => {
      let subscriptionValues: any[] = [null, { endpoint: 'test' }, {}]

      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => subscriptionValues.shift()
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      await expect(pushManager.unsubscribeUser()).rejects.toThrowError()
    })

    it('throws error when no subscription', async () => {
      let subscriptionValues: any[] = [null, { endpoint: 'test' }, null]

      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => subscriptionValues.shift()
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      await expect(pushManager.unsubscribeUser()).rejects.toThrowError()
    })

    it('resolves when not subscribed', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => null
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      await expect(pushManager.unsubscribeUser()).resolves.not.toThrowError()
    })

    it('resolves when unsubscribe was successful', async () => {
      mockServiceWorker({
        register: () => ({
          pushManager: {
            getSubscription: () => ({
              endpoint: 'test',
              unsubscribe: () => Promise.resolve(true)
            })
          }
        })
      })

      await pushManager.register('', null, (x) => Promise.resolve(x))

      await expect(pushManager.unsubscribeUser()).resolves.not.toThrowError()
    })
  })

  function mockServiceWorker(serviceWorker: any): void {
    windowMock.mockReturnValue({
      atob,
      btoa,
      navigator: {
        serviceWorker
      },
      PushManager: {}
    } as any)
  }
})
