import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';

import { LocaleContext, dictionaries, type Locale } from './index';

const LOCALE_KEY = 'aimenu.locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ka');

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_KEY)
      .then(v => {
        if (v === 'ka' || v === 'en') setLocaleState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      locale,
      t: dictionaries[locale] as unknown as import('./index').Dict,
      setLocale: (l: Locale) => {
        setLocaleState(l);
        AsyncStorage.setItem(LOCALE_KEY, l).catch(() => {});
      },
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
