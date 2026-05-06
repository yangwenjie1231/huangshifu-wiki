import { defaultSchema, type Options as Schema } from 'rehype-sanitize';

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
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames, 'iframe'],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    div: ['className'],
    span: ['className'],
    iframe: [
      'src',
      'allow',
      'allowFullScreen',
      'className',
      'frameBorder',
      'height',
      'loading',
      'referrerPolicy',
      'scrolling',
      'style',
      'title',
      'width',
    ],
  },
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
