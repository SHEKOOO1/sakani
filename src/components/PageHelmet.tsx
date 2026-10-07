import { Helmet } from 'react-helmet-async';

interface PageHelmetProps {
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
}

const SITE_NAME = 'سكني';
const DEFAULT_DESCRIPTION = 'نظام إدارة سكن الطلاب الذكي - منصة متكاملة لإدارة السكن الطلابي والمبيتات';
const DEFAULT_IMAGE = '/img/pwa-512x512.png';

export function PageHelmet({ title, description, ogImage, ogType = 'website' }: PageHelmetProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — ${DEFAULT_DESCRIPTION}`;
  const desc = description || DEFAULT_DESCRIPTION;
  const img = ogImage || DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
    </Helmet>
  );
}
