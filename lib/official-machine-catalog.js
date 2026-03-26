const defaultMachines = require("./default-machines");

function normalizeOfficialMachineKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const officialMachines = defaultMachines.map((item) => ({
  machine_name: String(item.machine_name || "").trim(),
  imei: String(item.imei || "").trim(),
  machine_key: normalizeOfficialMachineKey(item.machine_name),
}));

const officialMachineMap = new Map(
  officialMachines.map((item) => [item.machine_key, item])
);

function listOfficialMachines() {
  return officialMachines.map((item) => ({
    machine_name: item.machine_name,
    imei: item.imei,
  }));
}

function resolveOfficialMachine(value) {
  const key = normalizeOfficialMachineKey(value);
  if (!key) return null;
  return officialMachineMap.get(key) || null;
}

function isOfficialMachineName(value) {
  return Boolean(resolveOfficialMachine(value));
}

function isOfficialGoalItem(item) {
  const machineName = String(item?.machine_name || "").trim();
  const imei = String(item?.imei || "").trim();
  if (!machineName || !imei) return false;

  const officialMachine = resolveOfficialMachine(machineName);
  if (!officialMachine) return false;

  return officialMachine.imei === imei;
}

module.exports = {
  isOfficialGoalItem,
  isOfficialMachineName,
  listOfficialMachines,
  normalizeOfficialMachineKey,
  resolveOfficialMachine,
};
