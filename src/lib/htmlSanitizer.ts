import rehypeSanitize, { type Options as Schema } from 'rehype-sanitize';

const IFRAME_WHITELIST = [
  'player.bilibili.com',
  'music.163.com',
  'y.qq.com',
  'youtube.com',
  'www.youtube.com',
  'player.youku.com',
  'open.iqiyi.com',
  'www.iqiyi.com',
  'weibo.com',
  'www.weibo.com',
  'vimeo.com',
  'player.vimeo.com',
];

export const customSchema: Schema = {
  tagNames: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'strong', 'b', 'em', 'i', 'u', 'del', 's',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'span', 'div',
    'iframe',
  ],
  attributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: [
      'src',
      'width',
      'height',
      'frameborder',
      'allowfullscreen',
      'scrolling',
      'title',
      'style',
      'allow',
    ],
    td: ['colspan', 'rowspan', 'align'],
    th: ['colspan', 'rowspan', 'align', 'scope'],
    span: ['class', 'style'],
    div: ['class', 'style'],
    blockquote: ['class'],
    pre: ['class'],
    code: ['class'],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  clobberPrefix: 'user-content-',
};

export function isTrustedIframeDomain(src: string | undefined): boolean {
  if (!src) return false;

  try {
    let url: URL;
    if (src.startsWith('//')) {
      url = new URL('https:' + src);
    } else if (!src.startsWith('http://') && !src.startsWith('https://')) {
      url = new URL('https://' + src);
    } else {
      url = new URL(src);
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

    return IFRAME_WHITELIST.some((domain) => {
      const d = domain.toLowerCase().replace(/^www\./, '');
      return hostname === d || hostname.endsWith('.' + d);
    });
  } catch {
    return false;
  }
}