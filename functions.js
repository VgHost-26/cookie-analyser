export function parseCookieFromHeader(rawCookies) {
  return rawCookies.map(rawCookie => {
    const props = rawCookie.split(';')
    return props.map(prop => {
      const [name, value] = prop.split('=')
      const nameTrimed = name.trim()
      return { [nameTrimed]: value }
    })
  })
}
