/* eslint-disable @typescript-eslint/no-explicit-any */

import LeanplumRequest from '../../src/LeanplumRequest'
import LocalStorageManager from '../../src/LocalStorageManager'
import Constants from '../../src/Constants'

describe(LeanplumRequest, () => {
  let request: LeanplumRequest
  let lsGetSpy: jest.SpyInstance

  beforeEach(() => {
    request = new LeanplumRequest()
    lsGetSpy = jest.spyOn(LocalStorageManager, 'getFromLocalStorage').mockReturnValue(undefined)
  })

  afterEach(() => {
    lsGetSpy.mockClear()
  })

  it('returns instance userId, when available', () => {
    request.userId = 'IN123'

    expect(request.userId).toBe('IN123')
    expect(lsGetSpy).toHaveBeenCalledTimes(0)
  })

  it('returns userId from localStorage, when no instance value', () => {
    lsGetSpy.mockReturnValueOnce('LS123')

    expect(request.userId).toBe('LS123')
    expect(lsGetSpy).toHaveBeenCalledTimes(1)
  })

  it('returns deviceId, when no instance and localStorage value', () => {
    request.deviceId = 'DE123'

    expect(request.userId).toBe('DE123')
    expect(lsGetSpy).toHaveBeenCalledTimes(1)
  })

  it('resolves file urls', () => {
    const filename = 'image.png'
    const version = Constants.SDK_VERSION
    const appId = 'app_123'
    const secret = 'prod_234'
    request.appId = appId
    request.clientKey = secret

    const url = request.getFileUrl(filename)

    expect(url).toEqual(`https://api.leanplum.com/api?appId=${appId}&client=js&clientKey=${secret}&sdkVersion=${version}&action=downloadFile&filename=${filename}`)
  })

  it('returns empty string for empty filenames', () => {
    expect(request.getFileUrl('')).toEqual('')
  })
})
