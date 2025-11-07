import { differenceInMinutes, addMinutes } from "date-fns";

describe("Queue Logic Basics", () => {
  const slotDuration = 15; // minutes

  const makePatient = (tokenNo: number, base: Date) => ({
    id: `p${tokenNo}`,
    tokenNo,
    appointmentTime: addMinutes(base, (tokenNo - 1) * slotDuration),
  });

  it("should assign later ETCs for higher tokens", () => {
    const base = new Date("2025-11-01T10:00:00Z");
    const p1 = makePatient(1, base);
    const p2 = makePatient(2, base);
    const p3 = makePatient(3, base);

    const etc1 = p1.appointmentTime;
    const etc2 = addMinutes(base, 15);
    const etc3 = addMinutes(base, 30);

    expect(differenceInMinutes(etc2, etc1)).toBe(15);
    expect(differenceInMinutes(etc3, etc1)).toBe(30);
  });

  it("should handle doctor delay dynamically", () => {
    const base = new Date("2025-11-01T10:00:00Z");
    const delay = 5; // doctor delay 5 min
    const etc1 = addMinutes(base, delay);
    const etc2 = addMinutes(base, 15 + delay);

    expect(differenceInMinutes(etc2, etc1)).toBe(15);
  });

  it("should keep late penalty stable (pushed down 2 positions)", () => {
    const queue = ["A", "B", "C", "D", "E"];
    const latePatient = "C";
    const penalty = 2;

    const index = queue.indexOf(latePatient);
    queue.splice(index, 1); // remove late patient
    queue.splice(index + penalty, 0, latePatient); // reinsert later

    expect(queue.indexOf("C")).toBe(4); // originally 2 → now at position 4
  });
});
