import path from "node:path";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Vazirmatn",
  fonts: [
    { src: path.join(process.cwd(), "lib/pdf-templates/fonts/Vazirmatn-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "lib/pdf-templates/fonts/Vazirmatn-Bold.ttf"), fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Vazirmatn",
    direction: "rtl",
    padding: 32,
    fontSize: 11,
    color: "#18181b",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#71717a",
    textAlign: "right",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "right",
    marginTop: 16,
    marginBottom: 8,
    borderBottom: "1px solid #e4e4e7",
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottom: "1px solid #f4f4f5",
  },
  rowLabel: {
    textAlign: "right",
    color: "#52525b",
  },
  rowValue: {
    textAlign: "left",
    fontWeight: "bold",
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 8,
    borderTop: "2px solid #18181b",
  },
  totalLabel: {
    textAlign: "right",
    fontSize: 13,
    fontWeight: "bold",
  },
  totalValue: {
    textAlign: "left",
    fontSize: 13,
    fontWeight: "bold",
  },
  paragraph: {
    textAlign: "right",
    marginTop: 4,
    lineHeight: 1.6,
  },
  footer: {
    marginTop: 32,
    fontSize: 9,
    color: "#a1a1aa",
    textAlign: "right",
  },
});

export type OfferPdfData = {
  customerName: string;
  createdAt: string;
  validityDate: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehicleMileage: number | null;
  vehicleCondition: string | null;
  currency: string;
  baseVehiclePrice: number | null;
  exportCompanyFee: number;
  transportCost: number;
  insuranceCost: number;
  iranCustomsEstimate: number;
  internalServiceFee: number;
  commissionAmount: number | null;
  finalCustomerPrice: number | null;
  deliveryTerms: string | null;
  paymentSteps: string | null;
};

const conditionLabel: Record<string, string> = {
  new: "نو",
  used_excellent: "کارکرده - عالی",
  used_good: "کارکرده - خوب",
  used_fair: "کارکرده - متوسط",
  damaged: "آسیب‌دیده",
};

function money(value: number | null, currency: string) {
  return `${(value ?? 0).toLocaleString("en-US")} ${currency}`;
}

export function OfferPdfDocument({ data }: { data: OfferPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>پیش‌فاکتور صادرات خودرو</Text>
        <Text style={styles.subtitle}>
          تاریخ: {data.createdAt} {data.validityDate ? `— اعتبار پیشنهاد تا: ${data.validityDate}` : ""}
        </Text>

        <Text style={styles.sectionTitle}>مشتری</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>نام / شرکت</Text>
          <Text style={styles.rowValue}>{data.customerName}</Text>
        </View>

        <Text style={styles.sectionTitle}>مشخصات خودرو</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>برند / مدل</Text>
          <Text style={styles.rowValue}>
            {data.vehicleBrand} {data.vehicleModel}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>سال تولید</Text>
          <Text style={styles.rowValue}>{data.vehicleYear ?? "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>کارکرد (کیلومتر)</Text>
          <Text style={styles.rowValue}>{data.vehicleMileage?.toLocaleString("en-US") ?? "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>وضعیت</Text>
          <Text style={styles.rowValue}>
            {data.vehicleCondition ? conditionLabel[data.vehicleCondition] ?? data.vehicleCondition : "-"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>جزئیات هزینه</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>قیمت خودرو</Text>
          <Text style={styles.rowValue}>{money(data.baseVehiclePrice, data.currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>هزینه شرکت صادراتی</Text>
          <Text style={styles.rowValue}>{money(data.exportCompanyFee, data.currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>هزینه حمل و نقل</Text>
          <Text style={styles.rowValue}>{money(data.transportCost, data.currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>بیمه</Text>
          <Text style={styles.rowValue}>{money(data.insuranceCost, data.currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>برآورد عوارض گمرکی ایران</Text>
          <Text style={styles.rowValue}>{money(data.iranCustomsEstimate, data.currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>هزینه خدمات داخلی</Text>
          <Text style={styles.rowValue}>{money(data.internalServiceFee, data.currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>کمیسیون</Text>
          <Text style={styles.rowValue}>{money(data.commissionAmount, data.currency)}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>مجموع نهایی</Text>
          <Text style={styles.totalValue}>{money(data.finalCustomerPrice, data.currency)}</Text>
        </View>

        {data.deliveryTerms ? (
          <>
            <Text style={styles.sectionTitle}>شرایط تحویل</Text>
            <Text style={styles.paragraph}>{data.deliveryTerms}</Text>
          </>
        ) : null}

        {data.paymentSteps ? (
          <>
            <Text style={styles.sectionTitle}>مراحل پرداخت</Text>
            <Text style={styles.paragraph}>{data.paymentSteps}</Text>
          </>
        ) : null}

        <Text style={styles.footer}>
          این سند صرفاً جنبه پیشنهادی دارد و پس از تأیید نهایی طرفین معتبر خواهد بود.
        </Text>
      </Page>
    </Document>
  );
}
