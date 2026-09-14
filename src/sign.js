/**
 * Signing, for the command-line scripts only.
 *
 * The web server never imports this file: it has no key and signs nothing.
 * Keeping @nimiq/core's signing out of the server also keeps the server small
 * enough to start fast wherever it is hosted.
 */

import * as Nimiq from "@nimiq/core";

export function keyPairFromHex(hex) {
  return Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(hex));
}

const addr = (a) =>
  a instanceof Nimiq.Address ? a : Nimiq.Address.fromUserFriendlyAddress(String(a));

/**
 * Nimiq charges by transaction size, and a staking transaction is bigger than a
 * plain transfer. So the fee is measured rather than assumed: build once at zero
 * to learn the size, then rebuild paying one luna per byte.
 *
 * This matters more than it looks. A transaction whose fee is too low is
 * accepted by the node and then never relayed — it comes back with a hash and
 * silently never lands, which is indistinguishable from a payment that was lost.
 */
function withMeasuredFee(build) {
  const probe = build(0n);
  const size = BigInt(probe.serializedSize);
  return build(size);
}

/** First-time staking: creates the staker and delegates to a validator. */
export function signCreateStaker({ keyPair, validator, valueLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newCreateStaker(
      keyPair.toAddress(),
      addr(validator),
      BigInt(valueLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/** Adding to a stake that already exists. */
export function signAddStake({ keyPair, staker, valueLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newAddStake(
      keyPair.toAddress(),
      addr(staker ?? keyPair.toAddress()),
      BigInt(valueLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/**
 * Getting out, step one of three: deactivate.
 *
 * The parameter is what stays **working**, not what leaves. Pass 0 to take
 * everything out. Deactivated stake moves to `inactiveBalance` and is released
 * one epoch after the next election block: up to about a day.
 *
 * This step is reversible — call it again with a higher number to put stake
 * back to work. The next one is not.
 */
export function signSetActiveStake({ keyPair, newActiveBalanceLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newSetActiveStake(
      keyPair.toAddress(),
      BigInt(newActiveBalanceLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/**
 * Getting out, step two of three. **Irreversible.**
 *
 * Retired stake can only ever be withdrawn — it can never go back to work. Only
 * released inactive balance can be retired, so this fails until the wait is up.
 */
export function signRetireStake({ keyPair, valueLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newRetireStake(
      keyPair.toAddress(),
      BigInt(valueLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/**
 * Getting out, step three of three: the money lands back in the wallet.
 *
 * In this one transaction the staking contract is the sender, so the fee comes
 * out of the retired balance itself. Asking for the whole retired amount plus a
 * fee asks for more than exists: the node accepts it, then it never lands.
 * Found on mainnet on 10 Sep 2026 — it is exactly the silent failure this app
 * is built to catch. So the amount withdrawn is the retired balance minus fee.
 */
export function signRemoveStake({ keyPair, retiredLuna, validityStartHeight, networkId }) {
  const retired = BigInt(retiredLuna);
  const build = (value, fee) =>
    Nimiq.TransactionBuilder.newRemoveStake(
      keyPair.toAddress(), value, fee, validityStartHeight, networkId,
    );
  const fee = BigInt(build(retired, 0n).serializedSize);
  if (fee >= retired) throw new Error("retired balance is too small to cover the fee");
  const tx = build(retired - fee, fee);
  tx.sign(keyPair);
  return tx;
}

/** Moving a stake to a different validator. */
export function signUpdateStaker({ keyPair, newValidator, reactivateAllStake = true, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newUpdateStaker(
      keyPair.toAddress(),
      addr(newValidator),
      reactivateAllStake,
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}
