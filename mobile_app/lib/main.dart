import 'package:flutter/material.dart';

void main() {
  runApp(const KrishnaRechargeApp());
}

class KrishnaRechargeApp extends StatelessWidget {
  const KrishnaRechargeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Krishna Recharge',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF1E3A8A),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      ),
      home: const LoginScreen(),
    );
  }
}

class RechargeRecord {
  final String txnRef;
  final String number;
  final String operatorName;
  final double amount;
  final double commission;
  final String status;
  final String time;

  RechargeRecord({
    required this.txnRef,
    required this.number,
    required this.operatorName,
    required this.amount,
    required this.commission,
    required this.status,
    required this.time,
  });
}

class LedgerEntry {
  final String type;
  final double amount;
  final double opening;
  final double closing;
  final String remark;
  final String time;

  LedgerEntry({
    required this.type,
    required this.amount,
    required this.opening,
    required this.closing,
    required this.remark,
    required this.time,
  });
}

class FundRequestItem {
  final String id;
  final double amount;
  final String mode;
  final String utr;
  final String requestTo;
  String status;

  FundRequestItem({
    required this.id,
    required this.amount,
    required this.mode,
    required this.utr,
    required this.requestTo,
    this.status = 'PENDING',
  });
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneCtrl = TextEditingController(text: '9876543210');
  final _pinCtrl = TextEditingController(text: '1234');

  void _login() {
    if (_phoneCtrl.text.trim().length < 10 || _pinCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter valid 10-digit mobile and PIN')),
      );
      return;
    }
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => MainShell(retailerPhone: _phoneCtrl.text.trim()),
      ),
    );
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircleAvatar(
                    radius: 32,
                    backgroundColor: Color(0xFF1E3A8A),
                    child: Icon(Icons.bolt, color: Colors.amber, size: 36),
                  ),
                  const SizedBox(height: 14),
                  const Text('Krishna Recharge', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const Text('B2B Retailer & Distributor Portal', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    maxLength: 10,
                    decoration: const InputDecoration(
                      labelText: 'Registered Mobile Number',
                      prefixIcon: Icon(Icons.phone_android),
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _pinCtrl,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: 'Login / T-PIN (Demo: 1234)',
                      prefixIcon: Icon(Icons.lock),
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: _login,
                      child: const Text('LOGIN TO PORTAL', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class MainShell extends StatefulWidget {
  final String retailerPhone;
  const MainShell({super.key, required this.retailerPhone});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  double _walletBalance = 2500.00;
  double _totalCommission = 0.00;
  final String _demoTpin = '1234';

  final List<RechargeRecord> _recharges = [];
  final List<LedgerEntry> _ledger = [
    LedgerEntry(
      type: 'CREDIT',
      amount: 2500.00,
      opening: 0.00,
      closing: 2500.00,
      remark: 'Opening Balance (Admin Load)',
      time: 'Today, 09:00 AM',
    ),
  ];
  final List<FundRequestItem> _fundRequests = [];

  String _nowLabel() {
    final now = DateTime.now();
    return '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  }

  bool _executeRecharge({
    required String number,
    required String operatorName,
    required double amount,
    required double ratePercent,
  }) {
    final comm = (amount * ratePercent) / 100;
    final netDebit = amount - comm;

    if (netDebit > _walletBalance) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Insufficient wallet balance! Please request funds.')),
      );
      return false;
    }

    final openBal = _walletBalance;
    final closeBal = openBal - netDebit;
    final ref = 'KR${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';

    setState(() {
      _walletBalance = closeBal;
      _totalCommission += comm;
      _recharges.insert(
        0,
        RechargeRecord(
          txnRef: ref,
          number: number,
          operatorName: operatorName,
          amount: amount,
          commission: comm,
          status: 'SUCCESS',
          time: _nowLabel(),
        ),
      );
      _ledger.insert(
        0,
        LedgerEntry(
          type: 'DEBIT',
          amount: netDebit,
          opening: openBal,
          closing: closeBal,
          remark: '$operatorName $number (Ref: $ref)',
          time: _nowLabel(),
        ),
      );
    });
    return true;
  }

  void _submitFundRequest(double amount, String mode, String utr, String requestTo) {
    setState(() {
      _fundRequests.insert(
        0,
        FundRequestItem(
          id: 'REQ${_fundRequests.length + 101}',
          amount: amount,
          mode: mode,
          utr: utr,
          requestTo: requestTo,
        ),
      );
    });
  }

  void _approveFundRequestDemo(FundRequestItem item) {
    if (item.status != 'PENDING') return;
    final openBal = _walletBalance;
    final closeBal = openBal + item.amount;

    setState(() {
      item.status = 'APPROVED';
      _walletBalance = closeBal;
      _ledger.insert(
        0,
        LedgerEntry(
          type: 'CREDIT',
          amount: item.amount,
          opening: openBal,
          closing: closeBal,
          remark: 'Fund Approved (${item.id} - ${item.utr})',
          time: _nowLabel(),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeTab(
        phone: widget.retailerPhone,
        balance: _walletBalance,
        commission: _totalCommission,
        recentRecharges: _recharges,
        onNavigateTab: (idx) => setState(() => _currentIndex = idx),
      ),
      RechargeTab(
        expectedTpin: _demoTpin,
        onRecharge: _executeRecharge,
      ),
      FundRequestTab(
        requests: _fundRequests,
        onSubmit: _submitFundRequest,
        onSimulateApprove: _approveFundRequestDemo,
      ),
      PassbookTab(ledger: _ledger, recharges: _recharges),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        title: const Text('Krishna Recharge', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                '₹${_walletBalance.toStringAsFixed(2)}',
                style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
          )
        ],
      ),
      body: pages[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.phone_android), label: 'Recharge'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Add Fund'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), label: 'Passbook'),
        ],
      ),
    );
  }
}

class HomeTab extends StatelessWidget {
  final String phone;
  final double balance;
  final double commission;
  final List<RechargeRecord> recentRecharges;
  final void Function(int) onNavigateTab;

  const HomeTab({
    super.key,
    required this.phone,
    required this.balance,
    required this.commission,
    required this.recentRecharges,
    required this.onNavigateTab,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF1E3A8A),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Retailer: $phone · Gold Package', style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 13)),
              const SizedBox(height: 10),
              const Text('Available Wallet Balance', style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 13)),
              Text(
                '₹${balance.toStringAsFixed(2)}',
                style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Commission: ₹${commission.toStringAsFixed(2)}', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.w600)),
                  ElevatedButton.icon(
                    onPressed: () => onNavigateTab(2),
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Add Fund'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.black),
                  )
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('Services', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          children: [
            _tile(Icons.smartphone, 'Mobile', () => onNavigateTab(1)),
            _tile(Icons.tv, 'DTH', () => onNavigateTab(1)),
            _tile(Icons.account_balance, 'Load Money', () => onNavigateTab(2)),
          ],
        ),
        const SizedBox(height: 20),
        const Text('Recent Recharges', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (recentRecharges.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No recharges yet. Use the Recharge tab to test.', style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          ...recentRecharges.take(5).map((r) => Card(
                child: ListTile(
                  title: Text('${r.operatorName} - ${r.number}'),
                  subtitle: Text('Ref: ${r.txnRef} · Comm: ₹${r.commission.toStringAsFixed(2)}'),
                  trailing: Text('₹${r.amount.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              )),
      ],
    );
  }

  Widget _tile(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Card(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: const Color(0xFF1E3A8A), size: 28),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class RechargeTab extends StatefulWidget {
  final String expectedTpin;
  final bool Function({
    required String number,
    required String operatorName,
    required double amount,
    required double ratePercent,
  }) onRecharge;

  const RechargeTab({super.key, required this.expectedTpin, required this.onRecharge});

  @override
  State<RechargeTab> createState() => _RechargeTabState();
}

class _RechargeTabState extends State<RechargeTab> {
  String _serviceType = 'Mobile';
  String _selectedOp = 'Jio';
  final _numberCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();

  final Map<String, double> _mobileRates = {'Jio': 2.40, 'Airtel': 2.50, 'Vi': 3.10, 'BSNL': 3.90};
  final Map<String, double> _dthRates = {'Tata Play': 2.90, 'Airtel DTH': 2.90, 'Dish TV': 3.10};

  Map<String, double> get _activeOps => _serviceType == 'Mobile' ? _mobileRates : _dthRates;

  void _confirmWithTpin() {
    final num = _numberCtrl.text.trim();
    final amt = double.tryParse(_amountCtrl.text.trim()) ?? 0;
    if (num.length < 6 || amt <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter valid subscriber ID and amount')));
      return;
    }

    final rate = _activeOps[_selectedOp] ?? 0;
    final comm = (amt * rate) / 100;
    final net = amt - comm;
    final tpinCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Recharge'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$_selectedOp: $num', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text('Amount: ₹${amt.toStringAsFixed(2)}'),
            Text('Margin ($rate%): ₹${comm.toStringAsFixed(2)}', style: const TextStyle(color: Colors.green)),
            Text('Net Debit: ₹${net.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: tpinCtrl,
              obscureText: true,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Enter T-PIN (Demo: 1234)', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (tpinCtrl.text.trim() != widget.expectedTpin) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invalid T-PIN')));
                return;
              }
              Navigator.pop(ctx);
              final ok = widget.onRecharge(number: num, operatorName: _selectedOp, amount: amt, ratePercent: rate);
              if (ok) {
                _numberCtrl.clear();
                _amountCtrl.clear();
              }
            },
            child: const Text('PAY NOW'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _numberCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final amt = double.tryParse(_amountCtrl.text.trim()) ?? 0;
    final rate = _activeOps[_selectedOp] ?? 0;
    final comm = (amt * rate) / 100;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'Mobile', label: Text('Prepaid Mobile')),
            ButtonSegment(value: 'DTH', label: Text('DTH Recharge')),
          ],
          selected: {_serviceType},
          onSelectionChanged: (val) {
            setState(() {
              _serviceType = val.first;
              _selectedOp = _activeOps.keys.first;
            });
          },
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: _activeOps.entries.map((e) {
            return ChoiceChip(
              label: Text('${e.key} (${e.value}%)'),
              selected: _selectedOp == e.key,
              onSelected: (_) => setState(() => _selectedOp = e.key),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _numberCtrl,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: _serviceType == 'Mobile' ? '10-Digit Mobile Number' : 'DTH Customer ID',
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _amountCtrl,
          keyboardType: TextInputType.number,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Recharge Amount (₹)', border: OutlineInputBorder()),
        ),
        if (amt > 0) ...[
          const SizedBox(height: 12),
          Text('Commission ($rate%): ₹${comm.toStringAsFixed(2)} · Net Debit: ₹${(amt - comm).toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
        ],
        const SizedBox(height: 18),
        SizedBox(
          height: 48,
          child: FilledButton(onPressed: _confirmWithTpin, child: const Text('PROCEED TO RECHARGE')),
        ),
      ],
    );
  }
}

class FundRequestTab extends StatefulWidget {
  final List<FundRequestItem> requests;
  final void Function(double amount, String mode, String utr, String requestTo) onSubmit;
  final void Function(FundRequestItem item) onSimulateApprove;

  const FundRequestTab({super.key, required this.requests, required this.onSubmit, required this.onSimulateApprove});

  @override
  State<FundRequestTab> createState() => _FundRequestTabState();
}

class _FundRequestTabState extends State<FundRequestTab> {
  final _amtCtrl = TextEditingController();
  final _utrCtrl = TextEditingController();
  String _mode = 'UPI';
  String _requestTo = 'Admin';

  void _submit() {
    final amt = double.tryParse(_amtCtrl.text.trim()) ?? 0;
    final utr = _mode == 'CASH' ? 'CASH-${DateTime.now().millisecond}' : _utrCtrl.text.trim();
    if (amt <= 0 || (_mode != 'CASH' && utr.length < 6)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter valid amount and UTR')));
      return;
    }
    widget.onSubmit(amt, _mode, utr, _requestTo);
    _amtCtrl.clear();
    _utrCtrl.clear();
  }

  @override
  void dispose() {
    _amtCtrl.dispose();
    _utrCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Request Wallet Balance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: ['Admin', 'My Distributor'].map((t) {
                    return ChoiceChip(label: Text(t), selected: _requestTo == t, onSelected: (_) => setState(() => _requestTo = t));
                  }).toList(),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: ['UPI', 'IMPS', 'CASH'].map((m) {
                    return ChoiceChip(label: Text(m), selected: _mode == m, onSelected: (_) => setState(() => _mode = m));
                  }).toList(),
                ),
                const SizedBox(height: 12),
                TextField(controller: _amtCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount (₹)', border: OutlineInputBorder())),
                if (_mode != 'CASH') ...[
                  const SizedBox(height: 12),
                  TextField(controller: _utrCtrl, decoration: const InputDecoration(labelText: 'UTR / Reference Number', border: OutlineInputBorder())),
                ],
                const SizedBox(height: 14),
                SizedBox(width: double.infinity, child: FilledButton(onPressed: _submit, child: const Text('SUBMIT FUND REQUEST'))),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        ...widget.requests.map((r) => Card(
              child: ListTile(
                title: Text('₹${r.amount.toStringAsFixed(2)} via ${r.mode} (${r.requestTo})'),
                subtitle: Text('UTR: ${r.utr} · Status: ${r.status}'),
                trailing: r.status == 'PENDING'
                    ? TextButton(onPressed: () => widget.onSimulateApprove(r), child: const Text('Demo Approve'))
                    : const Icon(Icons.verified, color: Colors.green),
              ),
            )),
      ],
    );
  }
}

class PassbookTab extends StatelessWidget {
  final List<LedgerEntry> ledger;
  final List<RechargeRecord> recharges;

  const PassbookTab({super.key, required this.ledger, required this.recharges});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const TabBar(tabs: [Tab(text: 'Wallet Ledger'), Tab(text: 'Recharge History')]),
          Expanded(
            child: TabBarView(
              children: [
                ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: ledger.length,
                  itemBuilder: (_, i) {
                    final e = ledger[i];
                    final isCredit = e.type == 'CREDIT';
                    return Card(
                      child: ListTile(
                        title: Text(e.remark, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: Text('Open: ₹${e.opening.toStringAsFixed(2)} → Close: ₹${e.closing.toStringAsFixed(2)} · ${e.time}'),
                        trailing: Text('${isCredit ? '+' : '-'}₹${e.amount.toStringAsFixed(2)}',
                            style: TextStyle(fontWeight: FontWeight.bold, color: isCredit ? Colors.green : Colors.red)),
                      ),
                    );
                  },
                ),
                recharges.isEmpty
                    ? const Center(child: Text('No recharges yet.'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: recharges.length,
                        itemBuilder: (_, i) {
                          final r = recharges[i];
                          return Card(
                            child: ListTile(
                              title: Text('${r.operatorName} - ${r.number}'),
                              subtitle: Text('Ref: ${r.txnRef} · Comm: ₹${r.commission.toStringAsFixed(2)} · ${r.time}'),
                              trailing: Text('₹${r.amount.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                            ),
                          );
                        },
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
