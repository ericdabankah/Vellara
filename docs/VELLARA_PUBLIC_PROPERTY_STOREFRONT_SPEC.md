# VELLARA Public Property Storefront: First-Launch Product Contract

## Purpose

The public property mini-website is a customer-facing commerce and discovery surface, not merely a photo gallery. It should help a visitor discover an offer, compare relevant options, understand availability and price, and take the next valid action: book, enquire, or request a viewing.

The first launch uses VELLARA-managed public URLs configured by the VELLARA team during developer-assisted onboarding. Custom customer domains are out of scope for this increment.

## Shared storefront experience

- Property-branded landing page with published name, location, description, contact/receptionist entry point and published cover/gallery images.
- Search/filter controls appropriate to the property's operating model.
- Results cards with a clear image, title, location, key attributes, price basis and availability state.
- Detail page for each published offer, with its full published image set, description, amenities/features, terms and a prominent action.
- Clear empty, loading, unavailable and error states. Never imply availability when the authoritative service has not confirmed it.
- Mobile-first layout, accessible labels, keyboard-operable filters and visible applied-filter state.
- Customer actions hand off to VELLARA's booking/enquiry flow. The browser does not directly create reservations or assert payment success.

## Hospitality storefront

Applies to hotels, serviced apartments and other short-stay accommodation, regardless of whether the physical building is an apartment or hotel.

### Required search inputs

- Check-in date.
- Check-out date.
- Number of guests.
- Optional room count where the property's inventory model supports it.

### Filters

- Price range, explicitly labelled with the rate basis (for example, per night).
- Guest capacity.
- Room/accommodation type.
- Amenities and relevant property features.
- Availability for the selected date range.

### Result-card facts

- Published image and accommodation name.
- Maximum guest capacity.
- Bed configuration and selected amenities when available.
- Price and currency, with the per-night basis made explicit.
- Availability for the requested date range, sourced from the authoritative reservation/inventory service.

### Rules

- Check-out must be after check-in.
- Guest count must be positive and cannot exceed the capacity of the offered unit or valid combination of units.
- A displayed price must identify whether it is per night or a total for the selected stay. Taxes/fees must not be silently implied as included.
- A room type's default nightly rate is a fallback display/configuration value, not proof of live availability and not necessarily the final quote.
- Final price and availability must be recalculated server-side before booking.
- Never expose private inventory, unpublished rooms, internal operational notes or tenant-only fields.

## Real-estate storefront

Real-estate listings are a separate domain from hotel room inventory. Do not reuse hotel check-in/check-out or guest-capacity semantics for long-term rentals or property sales.

### Relevant filters

- Listing purpose: for sale or for rent.
- Price range, with currency and sale/rent basis clearly shown.
- Property type.
- Location/area.
- Bedrooms and bathrooms where applicable.
- Listing status and viewing availability.

A viewing date/time may be offered as an enquiry or appointment filter once the viewing workflow exists. It is not accommodation availability.

## Publication and trust boundaries

- Only explicitly published offers and property assets are returned by the public resolver.
- Public URLs identify a property; they do not grant access to Owner Desk data.
- The resolver must map an unambiguous public route to one exact property record.
- Public APIs return a minimal allowlist of customer-visible fields.
- Search filters are query inputs, never authorization controls.
- Price, availability, capacity, booking eligibility and payment status are validated by VELLARA's authoritative backend before a transaction is committed.
- The AI receptionist and storefront must use the same authoritative availability and price rules.

## First-launch scope boundary

The Owner Desk Media interface prepares property-level images and metadata. It does not yet create hospitality room inventory, real-estate listings, date-based availability, dynamic pricing, checkout, payment or receipts.

Those are separate domain/API increments. This avoids presenting a polished storefront that appears bookable while its inventory and transaction services are not connected.

## Dependency decisions still required

- Backend approval of API prefix, response/error envelope and route schemas.
- Authoritative availability query and price-quote contracts for hospitality.
- Separate listing/search contracts for real estate.
- Public property route format and resolver uniqueness strategy.
- Publication lifecycle and signed-read URL implementation from the property-media contract.
