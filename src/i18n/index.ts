import { createContext, useContext } from 'react';

export type Locale = 'ka' | 'en';

export const dictionaries = {
  ka: {
    login: {
      title: 'ავტორიზაცია',
      subtitle: 'თქვენი რესტორნის პანელზე შესასვლელად\nშეიყვანეთ თქვენი მონაცემები',
      email: 'ელ. ფოსტა',
      password: 'პაროლი',
      restaurant: 'რესტორნის სლაგი',
      restaurantHint: 'მაგ. tiali',
      signIn: 'შესვლა',
      signingIn: 'შესვლა…',
      invalidCredentials: 'მონაცემები არასწორია',
    },
    nav: {
      reservations: 'ჯავშნები',
      orders: 'შეკვეთები',
      settings: 'პარამეტრები',
    },
    dashboard: {
      title: 'რესტორნის პანელი',
      subtitle: 'შეკვეთების მართვა და კონტროლი',
      stats: {
        pending: 'მოლოდინში',
        confirmed: 'დადასტურებული',
        today: 'დღეს სულ',
      },
      tabs: {
        allActive: 'ყველა აქტიური',
        pending: 'მოლოდინში',
        confirmed: 'დადასტურებული',
      },
      empty: 'ჯავშნები არ მოიძებნა',
    },
    reservationCard: {
      totalAmount: 'სულ თანხა:',
      menuValue: 'მენიუს ღირებულება:',
      reject: 'უარყოფა',
      confirm: 'დადასტურება',
      seated: 'დასაჯდომი',
      completed: 'დასრულებული',
      fullInfo: 'სრული ინფორმაცია',
      guests: 'სტუმარი',
      reservationOnly: 'კავშნი',
      reservationPlusOrder: 'კავშნი + შეკვეთა',
    },
    reservationDetails: {
      title: 'ჯავშნის დეტალები',
      guestInfo: 'მომხმარებლის ინფორმაცია',
      reservationInfo: 'ჯავშნის ინფორმაცია',
      orderedItems: 'შეკვეთილი კერძები',
      noPreOrder: 'წინასწარი შეკვეთა არ არის',
      subtotal: 'ქვე-ჯამი',
      tax: 'გადასახადი',
      service: 'მომსახურება',
      total: 'სულ:',
      specialRequests: 'სპეციალური მოთხოვნა',
      createdAt: 'შექმნის დრო:',
      markSeated: 'დასაჯდომად',
      markCompleted: 'დასრულება',
      markNoShow: 'არ გამოცხადდა',
      cancel: 'გაუქმება',
      back: 'უკან',
    },
    ordersScreen: {
      title: 'შეკვეთები',
      search: 'ძებნა',
      empty: 'აქტიური შეკვეთები არ არის',
      dragHint: 'გრძელად დააჭირე და ჩააგდე სხვა სვეტში',
      columns: {
        pending: 'მოლოდინში',
        confirmed: 'დადასტურებული',
        preparing: 'მზადდება',
        ready: 'მზადაა',
        served: 'მიტანილი',
      },
    },
    orderDetail: {
      items: 'კერძები',
      subtotal: 'ქვე-ჯამი',
      tax: 'გადასახადი',
      serviceCharge: 'მომსახურება',
      total: 'სულ',
      notes: 'შენიშვნა',
      cancel: 'გაუქმება',
      cancelOrder: 'შეკვეთის გაუქმება',
      actions: {
        accept: 'მიღება',
        startPrep: 'მომზადების დაწყება',
        markReady: 'მზადაა',
        markServed: 'მიტანა',
        complete: 'დასრულება',
      },
    },
    settings: {
      title: 'პარამეტრები',
      account: 'ანგარიში',
      accountBody: 'თქვენ ხართ რესტორნის მენეჯერი. სხვა ანგარიშზე გადასართავად გამოდით.',
      signOut: 'გასვლა',
      signOutConfirm: 'გამოსვლა?',
      signOutConfirmBody: 'ანგარიშზე დასაბრუნებლად საჭიროა ხელახლა შესვლა.',
      about: 'შესახებ',
      cancel: 'გაუქმება',
      language: 'ენა',
      restaurant: 'რესტორანი',
      restaurantHint: 'რესტორნის სლაგი',
      save: 'შენახვა',
    },
    common: {
      loading: 'იტვირთება…',
      retry: 'ახალი ცდა',
      close: 'დახურვა',
    },
  },
  en: {
    login: {
      title: 'Sign in',
      subtitle: 'Enter your credentials to access\nyour restaurant panel',
      email: 'Email',
      password: 'Password',
      restaurant: 'Restaurant slug',
      restaurantHint: 'e.g. tiali',
      signIn: 'Sign in',
      signingIn: 'Signing in…',
      invalidCredentials: 'Invalid email or password.',
    },
    nav: {
      reservations: 'Reservations',
      orders: 'Orders',
      settings: 'Settings',
    },
    dashboard: {
      title: 'Restaurant panel',
      subtitle: 'Manage and control your orders',
      stats: {
        pending: 'Pending',
        confirmed: 'Confirmed',
        today: 'Today total',
      },
      tabs: {
        allActive: 'All active',
        pending: 'Pending',
        confirmed: 'Confirmed',
      },
      empty: 'No reservations found',
    },
    reservationCard: {
      totalAmount: 'Total:',
      menuValue: 'Menu value:',
      reject: 'Reject',
      confirm: 'Confirm',
      seated: 'Seated',
      completed: 'Completed',
      fullInfo: 'Full information',
      guests: 'guests',
      reservationOnly: 'Reservation',
      reservationPlusOrder: 'Reservation + order',
    },
    reservationDetails: {
      title: 'Reservation details',
      guestInfo: 'Guest information',
      reservationInfo: 'Reservation information',
      orderedItems: 'Ordered items',
      noPreOrder: 'No pre-order',
      subtotal: 'Subtotal',
      tax: 'Tax',
      service: 'Service',
      total: 'Total:',
      specialRequests: 'Special request',
      createdAt: 'Created at:',
      markSeated: 'Mark seated',
      markCompleted: 'Complete',
      markNoShow: 'No-show',
      cancel: 'Cancel',
      back: 'Back',
    },
    ordersScreen: {
      title: 'Orders',
      search: 'Search',
      empty: 'No active orders',
      dragHint: 'Long-press a card, then drag it to another column',
      columns: {
        pending: 'Pending',
        confirmed: 'Confirmed',
        preparing: 'Preparing',
        ready: 'Ready',
        served: 'Served',
      },
    },
    orderDetail: {
      items: 'Items',
      subtotal: 'Subtotal',
      tax: 'Tax',
      serviceCharge: 'Service',
      total: 'Total',
      notes: 'Notes',
      cancel: 'Cancel',
      cancelOrder: 'Cancel order',
      actions: {
        accept: 'Accept order',
        startPrep: 'Start preparing',
        markReady: 'Mark ready',
        markServed: 'Mark served',
        complete: 'Complete',
      },
    },
    settings: {
      title: 'Settings',
      account: 'Account',
      accountBody: "You're signed in as the restaurant operator. Sign out to switch accounts.",
      signOut: 'Sign out',
      signOutConfirm: 'Sign out?',
      signOutConfirmBody: 'You will need to log in again to access orders.',
      about: 'About',
      cancel: 'Cancel',
      language: 'Language',
      restaurant: 'Restaurant',
      restaurantHint: 'Restaurant slug',
      save: 'Save',
    },
    common: {
      loading: 'Loading…',
      retry: 'Retry',
      close: 'Close',
    },
  },
} as const;

type DeepMutable<T> = { -readonly [K in keyof T]: T[K] extends object ? DeepMutable<T[K]> : T[K] };
export type Dict = DeepMutable<(typeof dictionaries)['ka']>;

interface LocaleContextValue {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'ka',
  t: dictionaries.ka,
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useContext(LocaleContext).t;
}
