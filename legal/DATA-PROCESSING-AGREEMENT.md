# Data Processing Agreement

**Between** [CLIENT LEGAL NAME] (the **Controller**)
**and** Kaymen Group LLC (the **Processor**)

**Drafted 19 August 2026. NOT REVIEWED BY A LAWYER.**

> **Why this exists.** Kaymen Group builds and then *runs* systems that hold the
> client's data — borrowers, riders, students, staff. That is not "supplying
> software", it is **processing personal data on the client's behalf**, which
> makes Kaymen a processor and the client a controller. Under GDPR Article 28
> a controller may not use a processor without a written contract containing
> the terms below. Israeli Privacy Protection Regulations (Data Security) 2017
> impose a parallel obligation via §15 for outsourced processing.
>
> If any client is subject to either regime and there is no signed DPA, it is
> **the client** who is in breach for engaging us without one. That is worth
> saying out loud when sending this: it is not paperwork we are imposing, it is
> paperwork that protects them.

**Placeholders marked `[...]` must be completed before signature.**

---

## 1. Definitions

Terms not defined here take the meaning given in the EU General Data Protection
Regulation 2016/679 ("GDPR"). "Data Protection Law" means GDPR, UK GDPR, the
Israeli Privacy Protection Law 5741-1981 and its regulations, and any other law
applying to the processing described in Annex A.

## 2. Roles and scope

2.1 The Controller determines the purposes and means of processing. The
Processor processes Personal Data only on the Controller's behalf.

2.2 The subject matter, duration, nature and purpose of processing, the types
of Personal Data and the categories of Data Subjects are set out in **Annex A**.

2.3 This agreement takes effect on the date of the last signature and continues
for as long as the Processor processes Personal Data for the Controller.

## 3. Processor obligations

The Processor shall:

**(a) Documented instructions.** Process Personal Data only on the Controller's
documented instructions, including on transfers to a third country, unless
required to do otherwise by law — in which case the Processor shall inform the
Controller before processing, unless that law prohibits it.

**(b) Confidentiality.** Ensure that persons authorised to process the Personal
Data are bound by confidentiality.

**(c) Security.** Implement the technical and organisational measures set out in
**Annex B**, and maintain measures appropriate to the risk under Article 32.

**(d) Sub-processors.** Not engage a sub-processor without the Controller's
prior authorisation. The Controller authorises the sub-processors listed in
**Annex C**. The Processor shall give the Controller at least **thirty (30)
days'** notice of any intended addition or replacement, during which the
Controller may object on reasonable data-protection grounds; if the objection
cannot be resolved, the Controller may terminate the affected services without
penalty. The Processor remains fully liable for its sub-processors' performance.

**(e) Data subject requests.** Taking into account the nature of the processing,
assist the Controller by appropriate technical and organisational measures in
responding to requests to exercise Data Subject rights. Where a Data Subject
contacts the Processor directly, the Processor shall not respond substantively
and shall forward the request to the Controller without undue delay.

**(f) Assistance.** Assist the Controller in ensuring compliance with Articles
32 to 36 — security, breach notification, impact assessments and prior
consultation — taking into account the nature of processing and the information
available to the Processor.

**(g) Breach notification.** Notify the Controller **without undue delay and in
any event within twenty-four (24) hours** of becoming aware of a Personal Data
Breach, providing the information the Controller needs for its own Article 33
notification. The Processor shall not notify a supervisory authority or Data
Subject on the Controller's behalf unless instructed to.

**(h) Deletion or return.** At the Controller's choice, delete or return all
Personal Data at the end of the provision of services, and delete existing
copies, unless retention is required by law.

> **Note, and it is a real one.** The commercial position published at
> kaymen.dev is that the Controller owns the code, the data and the servers and
> may take the whole system elsewhere at any time. Clause 3(h) is the data
> protection floor; the Client Agreement is where the wider export and exit
> commitments live, and they are deliberately more generous than this clause.

**(i) Audit.** Make available all information necessary to demonstrate
compliance with Article 28 and allow for and contribute to audits, including
inspections, conducted by the Controller or an auditor it mandates. The
Controller shall give reasonable notice, audit no more than once in any twelve
months except following a Personal Data Breach, and bear its own costs.

## 4. International transfers

4.1 The Processor shall not transfer Personal Data outside the UK/EEA except as
described in **Annex C** or on the Controller's instructions.

4.2 Where a transfer requires a lawful transfer mechanism, the parties shall
enter into the European Commission's Standard Contractual Clauses (Decision
2021/914), Module Two (Controller to Processor), which are incorporated by
reference. **[TO CONFIRM: whether any transfer occurs and which module applies —
this depends on where the Processor and each sub-processor are established.]**

## 5. Liability

Liability under this agreement is subject to the limitations in the Client
Agreement between the parties, except where Data Protection Law does not permit
those limitations to apply.

## 6. Precedence

Where this agreement conflicts with the Client Agreement on the processing of
Personal Data, this agreement prevails.

---

# Annex A — Details of processing

**Subject matter.** Operation, hosting and maintenance of the software system(s)
built by the Processor for the Controller.

**Duration.** For the term of the Client Agreement and any agreed exit period.

**Nature and purpose.** Hosting, storage, backup, maintenance, support,
diagnosis and repair of faults, and any processing the Controller instructs
through its use of the system.

**Types of Personal Data.** *Complete per engagement — this varies materially
and a generic list is not adequate.*

| Category | Example |
|---|---|
| Contact details | name, email, telephone, address |
| Account data | username, hashed password, sign-in records |
| [Sector-specific] | *[e.g. loan applications; lesson bookings; student records]* |
| Special category data | **[STATE WHETHER ANY — e.g. health-fund membership or therapeutic needs. If yes, Article 9 applies and this DPA needs a lawyer's eye before signature.]** |
| Children's data | **[STATE WHETHER ANY — if the system holds data about people under 16, say so here.]** |

**Categories of Data Subjects.** *[e.g. the Controller's customers, members,
students, patients, employees and contractors.]*

---

# Annex B — Technical and organisational measures

These are the measures actually implemented, not a wish list. Each is verifiable
in the running system.

**Access control**
- Individual named accounts; no shared logins.
- Passwords stored hashed, never in plaintext or reversibly encrypted.
- Accounts lock after repeated failed sign-in attempts.
- Sign-in attempts and password resets are recorded and retained 400 days.
- An unknown username and a wrong password return an identical error, so the
  login cannot be used to enumerate who holds an account.

**Network and application security**
- Every request passes a filter that inspects path, query, body and user agent
  against known attack signatures, scores what it finds, and refuses or records
  accordingly. Offending addresses are blocked automatically; blocks escalate
  with repeat offences and always expire.
- Private and loopback addresses are never blocked, so health checks cannot
  take a system down.
- TLS in transit for all client systems.

**Tenant isolation** *(multi-tenant systems only)*
- Row-level security enforced in the database rather than in application code.
- **[TO CONFIRM per system: that the application's database role is not a
  superuser. A superuser bypasses row-level security unconditionally, which is a
  failure mode this team has already encountered and fixed once.]**

**Data minimisation and retention**
- Raw operational records are pruned on a schedule; aggregate totals with no
  personal data are retained.
- Pruning refuses to delete beyond the newest successfully aggregated day, so a
  failed aggregation cannot cause silent data loss.

**Resilience**
- Backups taken and restore-tested rather than assumed.
- Patching and dependency updates applied as part of the monthly retainer.
- Monitoring with alerting on failure.

**Organisational**
- Development and testing use fabricated data. Screenshots and demonstrations
  are taken from local instances seeded with invented records — never from a
  production system and never from a copy of one.
- **[TO CONFIRM: written confidentiality undertakings from all personnel and
  contractors.]**

---

# Annex C — Sub-processors

*Read out of the codebase on 19 August 2026. This list must be kept current —
an out-of-date sub-processor annex is a breach of clause 3(d), not an
administrative slip.*

| Sub-processor | Purpose | Data | Location |
|---|---|---|---|
| **[HOSTING PROVIDER — TO CONFIRM]** | Servers and storage for the client system | All data in the system | **[TO CONFIRM]** |
| **[SMTP / EMAIL PROVIDER — TO CONFIRM]** | Outbound transactional email (welcome, password reset, notifications) | Recipient name and email address, message content | **[TO CONFIRM]** |
| Google LLC | Sign-in with Google, where the Controller's users choose it | Name, email address, Google account identifier | United States |

**Applies to the kaymen.dev marketing website only, not to client systems:**

| Sub-processor | Purpose | Data | Note |
|---|---|---|---|
| ip-api.com | Approximate location from IP address | Visitor IP address | **Sent over plain HTTP, not HTTPS** |
| Google LLC (Google Fonts) | Web font delivery | Visitor IP address, on every page load | Loaded from Google's CDN by the visitor's browser |

> **Both website entries are removable and should be removed.** Self-hosting the
> fonts eliminates Google from the visitor path entirely and makes the page
> faster. Truncating the IP before the geo lookup, or dropping geo, eliminates
> the other. See the note in the covering email.

---

## Signatures

| | Controller | Processor |
|---|---|---|
| Entity | [CLIENT LEGAL NAME] | Kaymen Group LLC |
| Registered address | [ ] | **[TO CONFIRM]** |
| Signed | | |
| Name | | |
| Position | | |
| Date | | |
