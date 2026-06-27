const SINGLE_REPORT_PLAN = 'singleReport';

const PLANS = [
  {
    id: 'oneYear',
    summary: /360 public record reports/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan1/
  },
  {
    id: 'threeMonth',
    summary: /90 public record reports/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan2/
  },
  {
    id: SINGLE_REPORT_PLAN,
    summary: /one public record report/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan3/
  },
  {
    id: 'fiveReports',
    summary: /10 public record reports/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan4/
  }
];

module.exports = {
  PLANS,
  SINGLE_REPORT_PLAN
};
