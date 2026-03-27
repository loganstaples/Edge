// Watch Nodes
import { NewsMonitorNode } from "./NewsMonitorNode";
import { PolymarketFeedNode } from "./PolymarketFeedNode";
import { GeminiMarketsFeedNode } from "./GeminiMarketsFeedNode";
import { TwitterMonitorNode } from "./TwitterMonitorNode";
import { CryptoPriceNode } from "./CryptoPriceNode";
import { OnChainActivityNode } from "./OnChainActivityNode";
import { CalendarTimerNode } from "./CalendarTimerNode";
import { StrategyLinkNode } from "./StrategyLinkNode";
// Think Nodes
import { AIAnalystNode } from "./AIAnalystNode";
import { SentimentScannerNode } from "./SentimentScannerNode";
import { ConsensusNode } from "./ConsensusNode";
import { HistoryTrackerNode } from "./HistoryTrackerNode";
import { FormulaNode } from "./FormulaNode";
// Decide Nodes
import { EdgeCalculatorNode } from "./EdgeCalculatorNode";
import { ArbitrageDetectorNode } from "./ArbitrageDetectorNode";
import { RouterNode } from "./RouterNode";
import { PriceAlertDecideNode } from "./PriceAlertDecideNode";
import { CooldownGateNode } from "./CooldownGateNode";
import { MultiConditionGateNode } from "./MultiConditionGateNode";
// Act Nodes
import { TradeAdvancedNode } from "./TradeAdvancedNode";
import { AlertAdvancedNode } from "./AlertAdvancedNode";
import { StrategyLinkActNode } from "./StrategyLinkActNode";

export const nodeTypeComponents: Record<string, any> = {
  // Watch
  news_monitor: NewsMonitorNode,
  polymarket_feed: PolymarketFeedNode,
  gemini_markets_feed: GeminiMarketsFeedNode,
  twitter_monitor: TwitterMonitorNode,
  crypto_price: CryptoPriceNode,
  onchain_activity: OnChainActivityNode,
  calendar_timer: CalendarTimerNode,
  strategy_link: StrategyLinkNode,
  // Think
  ai_analyst: AIAnalystNode,
  sentiment_scanner: SentimentScannerNode,
  consensus: ConsensusNode,
  history_tracker: HistoryTrackerNode,
  formula: FormulaNode,
  // Decide
  edge_calculator: EdgeCalculatorNode,
  arb_detector: ArbitrageDetectorNode,
  router: RouterNode,
  price_alert_decide: PriceAlertDecideNode,
  cooldown_gate: CooldownGateNode,
  multi_condition_gate: MultiConditionGateNode,
  // Act
  trade_advanced: TradeAdvancedNode,
  alert_advanced: AlertAdvancedNode,
  strategy_link_act: StrategyLinkActNode,

  // Legacy type aliases (older stored strategies use these names)
  news_feed: NewsMonitorNode,
  market_watch: NewsMonitorNode,
  polymarket_markets: PolymarketFeedNode,
  gemini_markets: GeminiMarketsFeedNode,
  market_filter: GeminiMarketsFeedNode,
  price_alert: PriceAlertDecideNode,
  sentiment: SentimentScannerNode,
  sentiment_analyzer: SentimentScannerNode,
  ai_probability_estimator: AIAnalystNode,
  gate: MultiConditionGateNode,
  threshold_gate: MultiConditionGateNode,
  and_or: MultiConditionGateNode,
  cooldown: CooldownGateNode,
  cooldown_timer: CooldownGateNode,
  trade: TradeAdvancedNode,
  trade_polymarket: TradeAdvancedNode,
  trade_gemini: TradeAdvancedNode,
  alert_log: AlertAdvancedNode,
};
