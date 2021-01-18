# api-sniff-mock 本地/远程mock接口嗅探及模拟工具
> 一个node中间件，服务于前端开发过程接口mock需要，支持本地Mock和远程Mock接口请求的方式，亦可混合使用，便于集成工程化自动化，即擦即用。


## 安装
```
npm i -D api-sniff-mock
```

## 快速上手

```javascript

const mw = apiSniffMock({
        remote: 'http://www.xxx.com', // 远程mock api请求url前缀
        root:  path.resolve(__dirname, '../../apiMock'), // 本地mock api所在根路径
        route: '/apiMock',  // 目标拦截路由，以对请求地址做检验，命中后开启mock功能。 参数接受字段串、正则、函数
        useVirtualRoute: true, // 是否使用虚拟route，如果值判断为真，则实际接口请求路径中不包含已配置的route参数值
        silence: true // 是否启用静默模式，如果为否会输入调试信息
    });


// browserSync

browserSync.init({
  server: {
    baseDir: "./",
     middleware: mw
}
});


// ebpack-dev-server

 devServer: {
    before(app) {
      if(process.env.npm_config_proxydev) {
        return;
      } else {
        app.use(mw)
      }
    },

    ...
 }   
```

## 本地mock示例

以模拟/api/login接口为例，配置同上述配置，本地mock数据文件路径为： /apiMock/api/login.js

```

// req 为request对象


var curTime = +new Date(),
start = curTime - 1000 * 90,
end = curTime + 1000 * 60;

var bodyData = req.bodyData; // post请求体数据对象
var queryData = req.queryData; // query数据对象
var pageSize = bodyData.pageSize || 10;
var pageNo = bodyData.pageNo || 1;

// 模块接口延迟
function sleep(numberMillis) { 
  var now = new Date(); 
  var exitTime = now.getTime() + numberMillis; 
  while (true) { 
    now = new Date(); 
    if (now.getTime() > exitTime) {
      doNext();
      return; 
    }
  } 
}

sleep(3000); // 延迟3秒后响应

function doNext(){

  // 响应请求
  callback({
     "code": bodyData.code,
     "password": bodyData.password,
     "sid": bodyData.sid
  });
}


```