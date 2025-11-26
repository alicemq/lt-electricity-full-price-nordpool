import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    nav: {
      title: 'NordPool electricity prices with taxes',
      today: 'Today',
      upcoming: 'Upcoming',
      settings: 'Settings'
    },
    home: {
      title: 'Electricity Prices',
      today: 'Today',
      tomorrow: 'Tomorrow'
    },
    upcoming: {
      title: 'Upcoming Prices',
      loading: 'Loading prices...',
      error: 'Failed to load prices.',
      empty: 'No upcoming prices available.'
    },
    settings: {
      title: 'Settings',
      esoTitle: 'ESO settings',
      colorTitle: 'Color thresholds',
      cheapThreshold: 'Cheap price threshold (ct/kWh)',
      expensiveThreshold: 'Expensive price threshold (ct/kWh)',
      rangesLabel: 'Price ranges from average (%)',
      cheapBelow: 'Cheap below',
      expensiveAbove: 'Expensive above',
      saveAndClose: 'Save and Close',
      timezoneLabel: 'Time zone',
      vatLabel: 'VAT',
      vatWith: 'With VAT',
      vatWithout: 'No VAT',
      planLabel: 'Plan',
      vendorMarginLabel: 'Vendor margin',
      vendorMarginHelp: 'Vendor margin in euros.',
      includeExtraTariffs: 'Include extra tariffs and costs',
      includeExtraTariffsHelp: 'When disabled, only VAT is applied. Zone, plan, and vendor margin are excluded from calculations.',
      planChangePrefix: 'You can change or select your tariff plan in the',
      planChangeLink: 'ESO self-service',
      planChangeSuffix: 'portal.',
      swaggerDocs: 'API Documentation',
      systemStatus: 'System Status',
      about: 'About & Help'
    },
    table: {
      noData: 'Price data is not yet available for selected date.\nData is typically available after 15:00 local time (13:00 UTC).',
      intervalHeader: 'Interval',
      priceHeader: 'Price ct/kWh',
      hourHeader: 'Hour',
      averageLabel: 'Average Price:',
      perInterval: 'Per interval',
      perHour: 'Per hour'
    },
    zones: {
      'Four zones': 'Four zones',
      'Two zones': 'Two zones',
      'Single zone': 'Single zone'
    },
    plans: {
      'Standart': 'Standard',
      'Smart': 'Smart',
      'Home': 'Home',
      'Home plus': 'Home Plus',
      'Effective': 'Effective'
    },
    about: {
      title: 'About & Help',
      descriptionTitle: 'About This Application',
      description: 'This application displays electricity prices from Nord Pool with all applicable taxes and fees. Prices are updated automatically and show both current and upcoming prices to help you plan your electricity usage efficiently.',
      settingsTitle: 'Settings Guide',
      esoSettingsTitle: 'ESO Settings',
      timezoneLabel: 'Time Zone',
      timezoneHelp: 'Select your time zone to display prices in your local time. This affects how times are shown in the price tables.',
      planLabel: 'Tariff Plan',
      planHelp: 'Choose your electricity tariff plan (Standard, Smart, Home, etc.). Different plans have different pricing structures and time schedules. You can change your plan in the ESO self-service portal.',
      vatLabel: 'VAT',
      vatHelp: 'Toggle to include or exclude Value Added Tax (VAT) in the displayed prices. When enabled, prices include 21% VAT.',
      vendorMarginLabel: 'Vendor Margin',
      vendorMarginHelp: 'Enter your electricity vendor\'s margin in euros per kWh. This is the additional cost charged by your electricity supplier on top of the base price.',
      includeExtraTariffsLabel: 'Include Extra Tariffs and Costs',
      includeExtraTariffsHelp: 'When enabled, all additional costs (zone-based pricing, plan-specific fees, vendor margin, distribution charges) are included in calculations. When disabled, only VAT is applied.',
      colorThresholdsTitle: 'Color Thresholds',
      cheapThresholdLabel: 'Cheap Price Threshold',
      cheapThresholdHelp: 'Set the absolute price threshold in cents per kWh. Prices below this value will be highlighted in green.',
      expensiveThresholdLabel: 'Expensive Price Threshold',
      expensiveThresholdHelp: 'Set the absolute price threshold in cents per kWh. Prices above this value will be highlighted in yellow.',
      rangesLabel: 'Price Ranges from Average',
      rangesHelp: 'Set percentage thresholds relative to the average price. Prices below the "Cheap below" percentage will be green, and prices above the "Expensive above" percentage will be yellow.',
      dataSourceTitle: 'Data Source',
      dataSource: 'Price data is sourced from the Nord Pool electricity market via the Elering API. The system supports both legacy 60-minute and new 15-minute Market Time Units (MTU) for accurate price representation.',
      dataAvailability: 'Price data is typically available after 15:00 local time (13:00 UTC) for the following day.',
      backToSettings: 'Back to Settings'
    }
  },
  lt: {
    nav: {
      title: 'NordPool elektros kaina su mokesčiais',
      today: 'Šiandien',
      upcoming: 'Artimiausios',
      settings: 'Nustatymai'
    },
    home: {
      title: 'Elektros kainos',
      today: 'Šiandien',
      tomorrow: 'Rytoj'
    },
    upcoming: {
      title: 'Artimiausios kainos',
      loading: 'Kraunamos kainos...',
      error: 'Nepavyko įkelti kainų.',
      empty: 'Nėra artimiausių kainų.'
    },
    settings: {
      title: 'Nustatymai',
      esoTitle: 'ESO nustatymai',
      colorTitle: 'Spalvų slenksčiai',
      cheapThreshold: 'Pigi kaina',
      expensiveThreshold: 'Brangi kaina',
      rangesLabel: 'Kainų diapazonai nuo vidurkio (%)',
      cheapBelow: 'Pigu žemiau vidurkio',
      expensiveAbove: 'Brangu aukščiau vidurkio',
      saveAndClose: 'Išsaugoti ir uždaryti',
      timezoneLabel: 'Laiko zona',
      vatLabel: 'PVM',
      vatWith: 'Su PVM',
      vatWithout: 'Be PVM',
      planLabel: 'Planas',
      vendorMarginLabel: 'Tiekėjo marža',
      vendorMarginHelp: 'Tiekėjo marža eurais.',
      includeExtraTariffs: 'Įtraukti papildomus tarifus ir mokesčius',
      includeExtraTariffsHelp: 'Išjungus, taikomas tik PVM. Zona, planas ir tiekėjo marža neįtraukiami į skaičiavimus.',
      planChangePrefix: 'Tarifo planą galite pakeisti / pasirinkti',
      planChangeLink: 'ESO savitarnos',
      planChangeSuffix: 'svetainėje.',
      swaggerDocs: 'API dokumentacija',
      systemStatus: 'Sistemos būsena',
      about: 'Apie & Pagalba'
    },
    table: {
      noData: 'Šiai datai kainų duomenys dar nepasiekiami.\nDuomenys įprastai pasiekiami po 15:00 vietos laiku (13:00 UTC).',
      intervalHeader: 'Intervalas',
      priceHeader: 'Kaina ct/kWh',
      hourHeader: 'Valanda',
      averageLabel: 'Vidutinė kaina:',
      perInterval: 'Pagal intervalus',
      perHour: 'Pagal valandas'
    },
    zones: {
      'Four zones': 'Keturių zonų',
      'Two zones': 'Dviejų zonų',
      'Single zone': 'Vienos zonos'
    },
    plans: {
      'Standart': 'Standartinis',
      'Smart': 'Išmanus',
      'Home': 'Namai',
      'Home plus': 'Namai plius',
      'Effective': 'Efektyvus'
    },
    about: {
      title: 'Apie & Pagalba',
      descriptionTitle: 'Apie programą',
      description: 'Ši programa rodo Nord Pool elektros kainas su visais taikomais mokesčiais ir prievolėmis. Kainos atnaujinamos automatiškai ir rodo tiek esamas, tiek artimiausias kainas, kad galėtumėte efektyviai planuoti elektros vartojimą.',
      settingsTitle: 'Nustatymų vadovas',
      esoSettingsTitle: 'ESO nustatymai',
      timezoneLabel: 'Laiko zona',
      timezoneHelp: 'Pasirinkite savo laiko zoną, kad kainos būtų rodomos jūsų vietos laiku. Tai turi įtakos laiko rodymui kainų lentelėse.',
      planLabel: 'Tarifo planas',
      planHelp: 'Pasirinkite savo elektros tarifo planą (Standartinis, Išmanus, Namai ir kt.). Skirtingi planai turi skirtingas kainų struktūras ir laiko grafikus. Planą galite pakeisti ESO savitarnos portale.',
      vatLabel: 'PVM',
      vatHelp: 'Perjunkite, kad įtrauktumėte arba neįtrauktumėte pridėtinės vertės mokesčio (PVM) į rodomas kainas. Įjungus, kainos apima 21% PVM.',
      vendorMarginLabel: 'Tiekėjo marža',
      vendorMarginHelp: 'Įveskite jūsų elektros tiekėjo maržą eurais už kWh. Tai papildomas mokestis, kurį jūsų elektros tiekėjas ima be bazinės kainos.',
      includeExtraTariffsLabel: 'Įtraukti papildomus tarifus ir mokesčius',
      includeExtraTariffsHelp: 'Įjungus, visi papildomi mokesčiai (zoninės kainos, planui būdingi mokesčiai, tiekėjo marža, platinimo mokesčiai) įtraukiami į skaičiavimus. Išjungus, taikomas tik PVM.',
      colorThresholdsTitle: 'Spalvų slenksčiai',
      cheapThresholdLabel: 'Pigios kainos slenkstis',
      cheapThresholdHelp: 'Nustatykite absoliutų kainos slenkstį centais už kWh. Kainos žemiau šios vertės bus paryškintos žaliai.',
      expensiveThresholdLabel: 'Brangios kainos slenkstis',
      expensiveThresholdHelp: 'Nustatykite absoliutų kainos slenkstį centais už kWh. Kainos aukščiau šios vertės bus paryškintos geltonai.',
      rangesLabel: 'Kainų diapazonai nuo vidurkio',
      rangesHelp: 'Nustatykite procentinius slenksčius, palyginti su vidutine kaina. Kainos žemiau "Pigu žemiau vidurkio" procento bus žalios, o kainos aukščiau "Brangu aukščiau vidurkio" procento bus geltonos.',
      dataSourceTitle: 'Duomenų šaltinis',
      dataSource: 'Kainų duomenys gaunami iš Nord Pool elektros rinkos per Elering API. Sistema palaiko tiek senąsias 60 minučių, tiek naujas 15 minučių rinkos laiko vienetus (MTU) tiksliam kainų rodymui.',
      dataAvailability: 'Kainų duomenys paprastai pasiekiami po 15:00 vietos laiku (13:00 UTC) kitai dienai.',
      backToSettings: 'Grįžti į nustatymus'
    }
  }
}

const savedLocale = localStorage.getItem('locale')

const i18n = createI18n({
  legacy: false,
  locale: savedLocale || 'lt',
  fallbackLocale: 'en',
  messages
})

export default i18n


