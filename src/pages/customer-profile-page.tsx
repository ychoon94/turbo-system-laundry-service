import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { Mail, MapPinned, Phone, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageIntro } from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const initialAddressForm = {
  label: "Home",
  contactName: "",
  contactPhone: "",
  addressLine1: "",
  addressLine2: "",
  postcode: "",
  city: "Singapore",
  state: "Singapore",
  buildingName: "",
  towerBlock: "",
  unitNumber: "",
  lobbyOrSecurityNote: "",
  accessInstructions: "",
  isDefault: true,
};

export function CustomerProfilePage() {
  const profile = useQuery(api.auth.getCurrentUserProfile, {});
  const addresses = useQuery(api.addresses.listMyAddresses, {});
  const createAddress = useMutation(api.addresses.createAddress);
  const [form, setForm] = useState(initialAddressForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (profile === undefined || addresses === undefined) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow="Profile"
        title="Customer identity, delivery notes, and the address book."
        description="Phase 1 keeps this page intentionally practical: sync the live Clerk profile, capture one complete delivery address, and make the lobby handoff unambiguous for later operational flows."
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <article className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Synced account
          </p>
          <h2 className="mt-3 text-4xl text-foreground">{profile.fullName}</h2>
          <div className="mt-6 grid gap-4">
            <ProfileRow
              icon={<Mail className="size-4" />}
              label="Email"
              value={profile.email ?? "No email on file"}
            />
            <ProfileRow
              icon={<Phone className="size-4" />}
              label="Phone"
              value={profile.phone ?? "No phone on file"}
            />
            <ProfileRow
              icon={<MapPinned className="size-4" />}
              label="Active branch"
              value={`${profile.branchName} · ${profile.currency} ${profile.pricePerLoad.toFixed(2)} per load`}
            />
          </div>
        </article>

        <article className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_90px_-60px_rgba(18,67,62,0.4)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                Address book
              </p>
              <h2 className="mt-2 text-3xl text-foreground">
                Save the building instructions once.
              </h2>
            </div>
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Plus className="size-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {addresses.length > 0 ? (
              addresses.map((address) => (
                <div
                  key={address._id}
                  className="rounded-[1.6rem] border border-border bg-background/70 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl text-foreground">
                        {address.label}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {address.contactName} · {address.contactPhone}
                      </p>
                    </div>
                    {address.isDefault ? (
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                    <br />
                    {address.buildingName}
                    {address.towerBlock ? ` · ${address.towerBlock}` : ""}
                    {address.unitNumber ? ` · ${address.unitNumber}` : ""}
                    <br />
                    {address.lobbyOrSecurityNote}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[1.6rem] border border-dashed border-border bg-background/55 p-5 text-sm leading-6 text-muted-foreground">
                Add your first address below so the order form can reuse it.
              </p>
            )}
          </div>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              startTransition(async () => {
                await createAddress({
                  ...form,
                  addressLine2: form.addressLine2 || undefined,
                  towerBlock: form.towerBlock || undefined,
                  unitNumber: form.unitNumber || undefined,
                  accessInstructions: form.accessInstructions || undefined,
                });
                setForm(initialAddressForm);
                setMessage("Address saved. It is ready for checkout.");
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="label"
                value={form.label}
                placeholder="Label"
                onChange={(event) =>
                  setForm((current) => ({ ...current, label: event.target.value }))
                }
              />
              <Input
                name="contactName"
                autoComplete="name"
                value={form.contactName}
                placeholder="Contact name"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactName: event.target.value,
                  }))
                }
                required
              />
              <Input
                name="contactPhone"
                type="tel"
                autoComplete="tel"
                value={form.contactPhone}
                placeholder="Contact phone"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactPhone: event.target.value,
                  }))
                }
                required
              />
              <Input
                name="buildingName"
                value={form.buildingName}
                placeholder="Building name"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    buildingName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <Input
              name="addressLine1"
              autoComplete="street-address"
              value={form.addressLine1}
              placeholder="Address line 1"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  addressLine1: event.target.value,
                }))
              }
              required
            />
            <Input
              name="addressLine2"
              autoComplete="address-line2"
              value={form.addressLine2}
              placeholder="Address line 2 (optional)"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  addressLine2: event.target.value,
                }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                name="postcode"
                autoComplete="postal-code"
                value={form.postcode}
                placeholder="Postcode"
                onChange={(event) =>
                  setForm((current) => ({ ...current, postcode: event.target.value }))
                }
                required
              />
              <Input
                name="towerBlock"
                value={form.towerBlock}
                placeholder="Tower / block"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    towerBlock: event.target.value,
                  }))
                }
              />
              <Input
                name="unitNumber"
                value={form.unitNumber}
                placeholder="Unit number"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unitNumber: event.target.value,
                  }))
                }
              />
            </div>
            <Textarea
              name="lobbyOrSecurityNote"
              value={form.lobbyOrSecurityNote}
              placeholder="Lobby or security handoff note"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lobbyOrSecurityNote: event.target.value,
                }))
              }
              required
            />
            <Textarea
              name="accessInstructions"
              value={form.accessInstructions}
              placeholder="Optional access instructions"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accessInstructions: event.target.value,
                }))
              }
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                We enforce lobby or security desk delivery in this phase.
              </p>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving address…" : "Save address"}
              </Button>
            </div>
            {message ? (
              <p aria-live="polite" className="text-sm font-medium text-primary">
                {message}
              </p>
            ) : null}
          </form>
        </article>
      </section>
    </div>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.6rem] border border-border bg-background/65 p-4">
      <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm leading-6 text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-52 animate-pulse rounded-[2rem] bg-card/70" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[28rem] animate-pulse rounded-[2rem] bg-card/70" />
        <div className="h-[28rem] animate-pulse rounded-[2rem] bg-card/70" />
      </div>
    </div>
  );
}
