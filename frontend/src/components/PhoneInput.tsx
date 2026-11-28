import { useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries().map((code) => ({
  code,
  name: displayNames.of(code) || code,
  callingCode: getCountryCallingCode(code),
})).sort((a, b) => a.name.localeCompare(b.name));

type Props = { name: string; value?: string; defaultCountry?: string };

export default function PhoneInput({ name, value = "", defaultCountry = "" }: Props) {
  const initial = useMemo(() => {
    const parsed = value ? parsePhoneNumberFromString(value) : undefined;
    return { country: (parsed?.country || defaultCountry || "") as CountryCode | "", number: value };
  }, [value, defaultCountry]);
  const [country, setCountry] = useState<CountryCode | "">(initial.country);
  const [number, setNumber] = useState(initial.number);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => {
    if (!number.trim()) return undefined;
    try { return parsePhoneNumberFromString(number, country || undefined); } catch { return undefined; }
  }, [number, country]);
  const valid = !number.trim() || Boolean(parsed?.isValid());
  const e164 = parsed?.isValid() ? parsed.number : "";

  useEffect(() => {
    inputRef.current?.setCustomValidity(valid ? "" : "Enter a valid phone number for the selected country.");
  }, [valid]);

  return <div className="phone-input">
    <div className="phone-input-controls">
      <select aria-label="Phone country" value={country} onChange={(event) => setCountry(event.target.value as CountryCode | "")}>
        <option value="">Select country</option>
        {countries.map((item) => <option key={item.code} value={item.code}>{item.name} (+{item.callingCode})</option>)}
      </select>
      <input ref={inputRef} type="tel" inputMode="tel" autoComplete="tel" value={number}
        onChange={(event) => setNumber(event.target.value)} placeholder={country ? "Enter phone number" : "Select a country first"}
        aria-invalid={!valid} />
    </div>
    <input type="hidden" name={name} value={e164} />
    <small className={valid ? "phone-input-hint" : "phone-input-error"}>
      {!number.trim() ? "Optional. Select a country before entering a local number."
        : valid ? e164 || "Enter a complete number to save it in international format."
        : "This number does not appear valid for the selected country."}
    </small>
  </div>;
}
