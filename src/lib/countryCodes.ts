"use client";

/**
 * Country codes for phone number inputs
 */

export interface CountryCode {
  value: string;
  label: string;
  flag: string;
  country: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { value: "+1", label: "+1", flag: "🇺🇸", country: "United States/Canada" },
  { value: "+44", label: "+44", flag: "🇬🇧", country: "United Kingdom" },
  { value: "+254", label: "+254", flag: "🇰🇪", country: "Kenya" },
  { value: "+255", label: "+255", flag: "🇹🇿", country: "Tanzania" },
  { value: "+256", label: "+256", flag: "🇺🇬", country: "Uganda" },
  { value: "+250", label: "+250", flag: "🇷🇼", country: "Rwanda" },
  { value: "+251", label: "+251", flag: "🇪🇹", country: "Ethiopia" },
  { value: "+252", label: "+252", flag: "🇸🇴", country: "Somalia" },
  { value: "+257", label: "+257", flag: "🇧🇮", country: "Burundi" },
  { value: "+234", label: "+234", flag: "🇳🇬", country: "Nigeria" },
  { value: "+233", label: "+233", flag: "🇬🇭", country: "Ghana" },
  { value: "+27", label: "+27", flag: "🇿🇦", country: "South Africa" },
  { value: "+91", label: "+91", flag: "🇮🇳", country: "India" },
  { value: "+86", label: "+86", flag: "🇨🇳", country: "China" },
  { value: "+81", label: "+81", flag: "🇯🇵", country: "Japan" },
  { value: "+82", label: "+82", flag: "🇰🇷", country: "South Korea" },
  { value: "+61", label: "+61", flag: "🇦🇺", country: "Australia" },
  { value: "+64", label: "+64", flag: "🇳🇿", country: "New Zealand" },
  { value: "+33", label: "+33", flag: "🇫🇷", country: "France" },
  { value: "+49", label: "+49", flag: "🇩🇪", country: "Germany" },
  { value: "+39", label: "+39", flag: "🇮🇹", country: "Italy" },
  { value: "+34", label: "+34", flag: "🇪🇸", country: "Spain" },
  { value: "+31", label: "+31", flag: "🇳🇱", country: "Netherlands" },
  { value: "+32", label: "+32", flag: "🇧🇪", country: "Belgium" },
  { value: "+41", label: "+41", flag: "🇨🇭", country: "Switzerland" },
  { value: "+46", label: "+46", flag: "🇸🇪", country: "Sweden" },
  { value: "+47", label: "+47", flag: "🇳🇴", country: "Norway" },
  { value: "+45", label: "+45", flag: "🇩🇰", country: "Denmark" },
  { value: "+358", label: "+358", flag: "🇫🇮", country: "Finland" },
  { value: "+7", label: "+7", flag: "🇷🇺", country: "Russia" },
  { value: "+971", label: "+971", flag: "🇦🇪", country: "UAE" },
  { value: "+966", label: "+966", flag: "🇸🇦", country: "Saudi Arabia" },
  { value: "+20", label: "+20", flag: "🇪🇬", country: "Egypt" },
  { value: "+212", label: "+212", flag: "🇲🇦", country: "Morocco" },
  { value: "+213", label: "+213", flag: "🇩🇿", country: "Algeria" },
  { value: "+216", label: "+216", flag: "🇹🇳", country: "Tunisia" },
  { value: "+218", label: "+218", flag: "🇱🇾", country: "Libya" },
  { value: "+220", label: "+220", flag: "🇬🇲", country: "Gambia" },
  { value: "+221", label: "+221", flag: "🇸🇳", country: "Senegal" },
  { value: "+222", label: "+222", flag: "🇲🇷", country: "Mauritania" },
  { value: "+223", label: "+223", flag: "🇲🇱", country: "Mali" },
  { value: "+224", label: "+224", flag: "🇬🇳", country: "Guinea" },
  { value: "+225", label: "+225", flag: "🇨🇮", country: "Ivory Coast" },
  { value: "+226", label: "+226", flag: "🇧🇫", country: "Burkina Faso" },
  { value: "+227", label: "+227", flag: "🇳🇪", country: "Niger" },
  { value: "+228", label: "+228", flag: "🇹🇬", country: "Togo" },
  { value: "+229", label: "+229", flag: "🇧🇯", country: "Benin" },
  { value: "+230", label: "+230", flag: "🇲🇺", country: "Mauritius" },
  { value: "+231", label: "+231", flag: "🇱🇷", country: "Liberia" },
  { value: "+232", label: "+232", flag: "🇸🇱", country: "Sierra Leone" },
  { value: "+235", label: "+235", flag: "🇹🇩", country: "Chad" },
  {
    value: "+236",
    label: "+236",
    flag: "🇨🇫",
    country: "Central African Republic",
  },
  { value: "+237", label: "+237", flag: "🇨🇲", country: "Cameroon" },
  { value: "+238", label: "+238", flag: "🇨🇻", country: "Cape Verde" },
  {
    value: "+239",
    label: "+239",
    flag: "🇸🇹",
    country: "São Tomé and Príncipe",
  },
  { value: "+240", label: "+240", flag: "🇬🇶", country: "Equatorial Guinea" },
  { value: "+241", label: "+241", flag: "🇬🇦", country: "Gabon" },
  {
    value: "+242",
    label: "+242",
    flag: "🇨🇬",
    country: "Republic of the Congo",
  },
  { value: "+243", label: "+243", flag: "🇨🇩", country: "DR Congo" },
  { value: "+245", label: "+245", flag: "🇬🇼", country: "Guinea-Bissau" },
  { value: "+248", label: "+248", flag: "🇸🇨", country: "Seychelles" },
  { value: "+249", label: "+249", flag: "🇸🇩", country: "Sudan" },
  { value: "+260", label: "+260", flag: "🇿🇲", country: "Zambia" },
  { value: "+261", label: "+261", flag: "🇲🇬", country: "Madagascar" },
  { value: "+262", label: "+262", flag: "🇷🇪", country: "Réunion" },
  { value: "+263", label: "+263", flag: "🇿🇼", country: "Zimbabwe" },
  { value: "+264", label: "+264", flag: "🇳🇦", country: "Namibia" },
  { value: "+265", label: "+265", flag: "🇲🇼", country: "Malawi" },
  { value: "+266", label: "+266", flag: "🇱🇸", country: "Lesotho" },
  { value: "+267", label: "+267", flag: "🇧🇼", country: "Botswana" },
  { value: "+268", label: "+268", flag: "🇸🇿", country: "Eswatini" },
  { value: "+269", label: "+269", flag: "🇰🇲", country: "Comoros" },
  { value: "+290", label: "+290", flag: "🇸🇭", country: "Saint Helena" },
  { value: "+291", label: "+291", flag: "🇪🇷", country: "Eritrea" },
  { value: "+298", label: "+298", flag: "🇫🇴", country: "Faroe Islands" },
  { value: "+299", label: "+299", flag: "🇬🇱", country: "Greenland" },
];

/**
 * Get country code data for Select component
 */
export function getCountryCodeSelectData(): Array<{
  value: string;
  label: string;
}> {
  return COUNTRY_CODES.map((code) => ({
    value: code.value,
    label: `${code.flag} ${code.value}`,
  }));
}

/**
 * Get full country code info
 */
export function getCountryCodeInfo(code: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.value === code);
}
