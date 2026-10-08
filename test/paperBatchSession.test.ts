/// <reference types="mocha" />

import { assert } from "chai";
import {
  BatchSession,
  beginBatchSession,
  hasActiveBatchSession,
  stopActiveBatchSession,
} from "../src/features/paper/batch/session";

function startSession(owner: object): BatchSession {
  const session = beginBatchSession(owner);
  assert.isNotNull(session);
  if (!session) {
    throw new Error("batch session was not created");
  }
  return session;
}

describe("paper batch session", function () {
  afterEach(function () {
    stopActiveBatchSession();
  });

  it("prevents a second batch from starting, including from another window", function () {
    const session = startSession({});

    assert.isTrue(session.isActive());
    assert.isTrue(hasActiveBatchSession());
    assert.isNull(beginBatchSession({}));

    session.finish();
    assert.isFalse(hasActiveBatchSession());
  });

  it("stopping one window only stops the batch that window owns", function () {
    const ownerWindow = {};
    const otherWindow = {};
    const session = startSession(ownerWindow);

    assert.isFalse(stopActiveBatchSession(otherWindow));
    assert.isTrue(session.isActive());
    assert.isTrue(hasActiveBatchSession());

    assert.isTrue(stopActiveBatchSession(ownerWindow));
    assert.isFalse(session.isActive());
    assert.isFalse(hasActiveBatchSession());
    assert.isFalse(stopActiveBatchSession(ownerWindow));
  });

  it("stops whichever batch is active when the plugin unloads", function () {
    const session = startSession({});

    assert.isTrue(stopActiveBatchSession());
    assert.isFalse(session.isActive());
    assert.isFalse(hasActiveBatchSession());
  });

  it("does not clear a newer session when a superseded session finishes", function () {
    const first = startSession({});
    first.finish();
    const second = startSession({});

    first.finish();

    assert.isTrue(second.isActive());
    assert.isTrue(hasActiveBatchSession());
    second.finish();
    assert.isFalse(hasActiveBatchSession());
  });
});
